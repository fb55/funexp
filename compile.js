module.exports = compile;

var CharClasses = require("./charclasses.js");

var Compilers = {
	//matches
	character: function(next, token, flags){
		var c = token.char;

		if(!flags.ignoreCase) return function(str, idx, matches){
				return str.charAt(idx) === c ? next(str, idx + 1, matches) : null;
			};

		var lower = c.toLowerCase(),
		    upper = c.toUpperCase();

		return function(str, idx, matches){
			var c = str.charAt(idx);
			return (c === lower || c === upper) ? next(str, idx + 1, matches) : null;
		};
	},
	escape: function(next, token, flags){
		token.char = decodeEscapedChar(token);
		return Compilers.character(next, token, flags);
	},
	escapeChar: function(next, token, flags){
		var func = CharClasses.escapeChars[token.value];
		if(!func) throw Error("escapeChar " + token.value + " not supported!");

		return function(str, idx, matches){
			return func(str, idx) ? next(str, idx + 1, matches) : null;
		};
	},
	characterClassRange: function(next, token, flags){
		//only required within characterClass
		var min = token.min.type === "character" ? token.min.char : decodeEscapedChar(token.min),
		    max = token.max.type === "character" ? token.max.char : decodeEscapedChar(token.max);

		if(flags.ignoreCase){
			return function(str, idx, matches){
				var c = str.charAt(idx);
				if(test(c.toLowerCase()) || test(c.toUpperCase())){
					next(str, idx + 1, matches);
				}
				return null;
			};
		}

		return function(str, idx, matches){
			return test(str.charAt(idx)) ? next(str, idx + 1, matches) : null;
		};

		function test(c){
			return c >= min && c <= max;
		}
	},
	characterClass: function(next, token, flags){
		//TODO optimize
		if(!token.negative) return token.classRanges.map(function(token){
				return Compilers[token.type](next, token, flags);
			}).reduce(disjunctReducer, nullFunc);

		var func = token.classRanges.map(function(token){
			return compile(token, flags);
		}).reduce(disjunctReducer, nullFunc);

		return function(str, idx, matches){
			return func(str, idx, matches) === null ? next(str, idx + 1, matches) : null;
		};
	},
	dot: function(next, token, flags){
		var dot = CharClasses.dot;
		return function(str, idx, matches){
			return dot(str, idx) ? next(str, idx + 1, matches) : null;
		};
	},

	empty: function(next, token, flags){
		return next;
	},

	assertion: function(next, token, flags){
		var lineTerminator = CharClasses.lineTerminator;
		switch(token.sub){
			case "start":
				if(flags.multiline){
					return function(str, idx, matches){
						return idx === 0 || lineTerminator(str.charAt(idx - 1)) ? next(str, idx, matches) : null;
					};
				}

				return function(str, idx, matches){
					return idx === 0 ? next(str, idx, matches) : null;
				};

			case "end":
				if(flags.multiline){
					return function(str, idx, matches){
						return idx === str.length || lineTerminator(str.charAt(idx)) ? next(str, idx, matches) : null;
					};
				}
				return function(str, idx, matches){
					return str.length === idx ? next(str, idx, matches) : null;
				};
			default: throw Error("token " + token.raw + " wasn't recognized");
		}
	},

	quantifier: function(next, token, flags){
		var min = token.min,
		    max = token.max,
		    func = Compilers[token.child.type](setLastIndex, token.child, flags);

		if(!isFinite(max)) max = Infinity; //ensure it isn't `undefined`

		if(min === max){
			return function(str, idx, matches){
				for(var i = 0, layer = matches; i < min; i++){
					layer = func(str, idx, matches);
					if(layer === null) return null;
					if(idx === layer.lastIndex) break;
					idx = layer.lastIndex;
				}

				return next(str, idx, layer);
			};
		}

		if(!token.greedy){
			return function(str, idx, matches){
				for(var i = 0, layer = matches; i < min; i++){
					layer = func(str, idx, matches);
					if(layer === null) return null;
					if(idx === layer.lastIndex) break;
					idx = layer.lastIndex;
				}

				while(layer !== null && i++ < max){
					layer = next(str, idx, layer);
					if(layer !== null) return layer;
					layer = func(str, idx, matches);
					if(layer === null) break;
					if(idx === layer.lastIndex) break;
					idx = layer.lastIndex;
				}

				return null;
			};
		}

		//the functional approach should only be used if it doesn't lead to a stack overflow
		//(here only 'cause it's pretty)
		if(max <= 50){
			return function(str, idx, matches){
				return (function step(min, max, idx){
					var layer = func(str, idx, matches);

					if(layer === null) return null;

					var nextIdx = layer.lastIndex;

					if(min > 0) return step(min - 1, max, nextIdx);
					if(max > 0 && idx !== nextIdx){
						return step(0, max - 1, nextIdx) || next(str, nextIdx, matches);
					}

					return next(str, nextIdx, matches);
				}(min, max - min - 1, idx));
			};
		}

		return function(str, idx, matches){
			for(var i = 0, layer = matches; i < min - 1; i++){
				layer = func(str, idx, matches);
				if(layer === null) return null;
				if(idx === layer.lastIndex) break;
				idx = layer.lastIndex;
			}

			var stack = [];

			while(layer !== null && i++ < max){
				layer = func(str, idx, matches);
				if(layer === null) break;
				if(idx === layer.lastIndex) break;
				idx = layer.lastIndex;
				stack.push(layer);
			}

			while(stack.length){
				layer = next(str, idx, stack.pop());
				if(layer !== null) return layer;
			}

			return null;
		};

		function setLastIndex(str, idx, matches){
			var result = next(str, idx, matches);
			if(result === null) return null;
			result.lastIndex = idx;
			return result;
		}
	},

	//groups
	group: function(next, token, flags){
		return Groups[token.behavior](next, token, flags);
	},
	ref: function(next, token, flags){
		var ref = token.ref;

		if(!flags.ignoreCase){
			return function(str, idx, matches){
				var match = matches[ref],
				    len = match === undefined ? 0 : match.length;

				if(
					len === 0 || (
						str.length - idx >= len &&
						str.substr(idx, len) === match
					)
				){
					return next(str, idx + len, matches);
				}

				return null;
			};
		}

		//when ignoreCase is set, lowercase both parts
		return function(str, idx, matches){
				var match = matches[ref],
				    len = match === undefined ? 0 : match.length;

				if(
					len === 0 || (
						str.length - idx >= len &&
						str.substr(idx, len).toLowerCase() === match.toLowerCase()
					)
				){
					return next(str, idx + len, matches);
				}

				return null;
			};
	},

	//con-/disjunctions
	alternative: function(next, token, flags){
		return token.terms.reduceRight(function(next, term){
			return Compilers[term.type](next, term, flags);
		}, next);
	},
	disjunction: function(next, token, flags){
		return token.alternatives.map(function(term){
			return Compilers[term.type](next, term, flags);
		}).reduceRight(disjunctReducer, nullFunc);
	}

};

var Groups = {
	normal: function(next, token, flags){
		var matchIdx = token.matchIdx,
		    start = 0, //TODO avoid variabe leakage
		    disjunction = Compilers[token.disjunction.type](setResult, token.disjunction, flags);

		return function(str, idx, matches){
			start = idx;
			var layer = {"__proto__": matches, lastIndex: idx};
			return disjunction(str, idx, layer);
		};

		function setResult(str, idx, matches){
			matches[matchIdx] = str.substring(start, idx);
			return next(str, idx, matches);
		}
	},
	ignore: function(next, token, flags){
		return Compilers[token.disjunction.type](next, token.disjunction, flags);
	},
	lookahead: function(next, token, flags){
		//backtracking doesn't apply here, cheat
		var func = compile(token.disjunction, flags);
		return function(str, idx, matches){
			var lastIndex = matches.lastIndex;
			var results = func(str, idx, matches);

			if(results === null) return null;

			results.lastIndex = lastIndex;

			return next(str, idx, results);
		};
	},
	negativeLookahead: function(next, token, flags){
		var func = compile(token.disjunction, flags);
		return function(str, idx, matches){
			var results = func(str, idx, {"__proto__": matches});
			return results === null ? next(str, idx, matches) : null;
		};
	}
};

function compile(token, flags){
	return Compilers[token.type](echoFunc, token, flags);
}

function echoFunc(str, idx, matches){
	matches.lastIndex = idx;
	return matches;
}

function disjunctReducer(choice, func){
	if(choice === nullFunc) return func;

	return function(str, idx, matches){
		return func(str, idx, matches) || choice(str, idx, matches);
	};
}

function nullFunc(){
	return null;
}

function decodeEscapedChar(token){
	var code, value = token.value;

	switch(token.name){
		case "identifier":
			return token.char;
		case "unicode":
			code = parseInt(value, 16);
			break;
		case "controlLetter":
			code = value.charCodeAt(0) % 32;
			break;
		case "octal":
			code = parseInt(value, 8);
			break;
		case "hex":
			code = parseInt(value, 16);
			break;
		case "null":
			code = 0;
			break;
		default:
			throw Error("unrecognized escape type: " + token.name);
	}

	return String.fromCharCode(code);
}