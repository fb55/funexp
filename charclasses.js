var t = isChar("\t"),
    n = isChar("\n"),
    v = isChar("\v"),
    f = isChar("\f"),
    r = isChar("\r"),
    d = range("0", "9"),
    D = invert(d),
    w = join(d, range("a", "z"), range("A", "Z"), isChar("_")),
    W = invert(w),
    lineTerminator = join(n, r, isChar("\u2028"), isChar("\u2029")),
    //taken from jviereck/regexp.js, which took it from esprima (changed to fit functional style)
    s = join(lineTerminator, [ 9, 11, 12, 32, 160 ].map(function(c){
		return isChar(String.fromCharCode(c));
    }).reduce(joinTwo), function(str, idx){
		var c = str.charAt(idx);
		return c >= "\u1680" && "\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF".indexOf(c) >= 0;
    }),
    S = invert(s),
    b = function(str, idx){
		var a = idx > 0 && w(str, idx - 1),
		    b = idx < str.length && w(str, idx);

		return (a && !b) || (!a && b); //xor
    },
    B = invert(b),
    dot = invert(lineTerminator);


module.exports = {
	escapeChars: {
		t: t,
		n: n,
		v: v,
		f: f,
		r: r,
		d: d,
		D: D,
		w: w,
		W: W,
		s: s,
		S: S,
		b: b,
		B: B
	},
	lineTerminator: lineTerminator,
	dot: dot
};

function isChar(chr){
	return function(str, idx){
		return str.charAt(idx) === chr;
	};
}

function range(min, max){
	return function(str, idx){
		var c = str.charAt(idx);
		return c >= min && c <= max;
	};
}

function invert(func){
	return function(str, idx){
		return idx < str.length && !func(str, idx);
	};
}

function join(){
	return Array.prototype.reduce.call(arguments, joinTwo);
}

function joinTwo(a, b){
	return function(str, idx){
		return a(str, idx) || b(str, idx);
	};
}