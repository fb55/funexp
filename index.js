var parse = require("regjsparser").parse,
    compile = require("./compile.js");

module.exports = FunExp;

var flagNames = {
	i: "ignoreCase",
	g: "global",
	m: "multiline",
	y: "sticky"
};

function FunExp(source, flags){
	if(!(this instanceof FunExp)) return new FunExp(source, flags);
	this.lastIndex = 0;
	this.source = source;
	this.global = false;
	this.ignoreCase = false;
	this.multiline = false;
	this.sticky = false;

	for(var i = 0; flags && i < flags.length; i++){
		var c = flags.charAt(i);
		if(!(c in flagNames)) throw Error("unrecognized flag: " + c);
		if(this[flagNames[c]]) throw Error("flag set twice: " + c);
		this[flagNames[c]] = true;
	}

	this._parsed = parse(source, this);
	this._compiled = compile(this._parsed, this);

}

FunExp.prototype.valueOf = function(){
	var flags = "";

	Object.keys(flagNames).forEach(function(flag){
		if(this[flagNAmes[flag]]) flags += flag;
	});

	return new RegExp(this.source, flags);
};

FunExp.prototype.test = function(str){
	return this.exec(str) !== null;
};

FunExp.prototype.exec = function(str){
	var matches = {length: this._parsed.lastMatchIdx + 1, 0: "", lastIndex: 0};

	var idx = this.lastIndex, result = null;

	if(this.sticky){
		result = this._compiled(str, idx, matches);
	} else {
		while(idx < str.length && result === null){
			result = this._compiled(str, idx++, matches);
		}
		idx--;
	}

	if(result === null) return null;

	result[0] = str.substring(idx, result.lastIndex);

	result = Array.apply(null, result);
	result.index = idx;
	result.input = str;

	this.lastIndex = idx;

	return result;
};