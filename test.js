var assert = require("assert"),
    FunExp = require("./");

var failed = 0;

function assertRegExp(re, str){
	var flags = "";
	if(re.global)     flags += "g";
	if(re.ignoreCase) flags += "i";
	if(re.multiline)  flags += "m";

	var fun = new FunExp(re.source, flags);

	var original = re.exec(str),
	    funny = fun.exec(str);

	try{assert.deepEqual(original, funny);}
	catch(e){
		console.log("%d. Error %s: %j != %j for %j", ++failed, re.toString(), original, funny, str);
	}
}

//Taken from https://github.com/jviereck/regexp.js/ (licensed under BSD)
assertRegExp(/a+/, 'a');
assertRegExp(/[cba]/, 'da');
assertRegExp(/a(?:b)c/, 'abc');
assertRegExp(/ab(?!d)/, 'abdabc');
assertRegExp(/ab(?=c)/, 'abdabc');
assertRegExp(/\u0020/, 'a ');
assertRegExp(/[\u0020]/, 'a ');
assertRegExp(/[a-z]/, 'd');
assertRegExp(/(a)|(b)/, 'a');
assertRegExp(/(a)|(b)/, 'b');
assertRegExp(/\w/, 'a');
assertRegExp(/\s\w*/, 'foo bar');
assertRegExp(/\S\w*/, 'foo bar');
assertRegExp(/[^]/, 'b');
assertRegExp(/\x20/, ' ');
assertRegExp(/[\x20-\x21]/, ' ');
assertRegExp(/\02/, '\\02');
assertRegExp(/(.)\01/, 'a\\1');
assertRegExp(/\00/, '\00');  // matches ['\0'] and NOT ['\00']
assertRegExp(/\091/, '\091');
assertRegExp(/\71/, '9');   // because: parseInt('71',8) == 57 == '9'.charCodeAt(0);
assertRegExp(/\0001/, '\0001');
assertRegExp(/\91/, '91');
assertRegExp(/(.)(.)(.)(.)(.)(.)(.)(.)(.)\91/, '12345678991');


// From the notes at 15.10.2.5:
assertRegExp(/a[a-z]{2,4}/, 'abcdefghi');
assertRegExp(/a[a-z]{2,4}?/, 'abcdefghi');
assertRegExp(/(aa|aabaac|ba|b|c)*/, 'aabaac');
assertRegExp(/(a*)b\1+/, 'baaaac');
assertRegExp(/(z)((a+)?(b+)?(c))*/, 'zaacbbbcac');

// Test for multiple lines and `multiline` flag.
assertRegExp(/b/, 'a\nb');
assertRegExp(/^b/, 'a\nb');
assertRegExp(/a$/, 'a\nb');
assertRegExp(/b$/, 'a\nb');

// Boundary \b and \B tests.
assertRegExp(/\bab/, 'ab cd');
assertRegExp(/ab\b/, 'ab cd');
assertRegExp(/\bcd/, 'ab cd');
assertRegExp(/cd\b/, 'ab cd');
assertRegExp(/\Blo/, 'hallo');
assertRegExp(/l\B/, 'hal la');

assertRegExp(/(\w+).*?(\w+)/, 'foo: bar');
assertRegExp(/(?:(a+))a*b\1/, 'baaabac');
assertRegExp(/(?=(a+?))/, 'baaabac');
assertRegExp(/(?!(a{2,}))b/, 'baaabac');
assertRegExp(/(q?)b\1/, 'b');
assertRegExp(/(q)?b\1/, 'b');

// Referencing (some tests taken from the spec, see 15.10.2.8)
assertRegExp(/a(.)a\1/, 'abab');
assertRegExp(/(?=(a+))/, 'baaabac');
assertRegExp(/(?=(a+))a*b\1/, 'baaabac');
assertRegExp(/(.*?)a(?!(a+)b\2c)\2(.*)/, 'baaabaac');

// Repetition
assertRegExp(/((a)|(b))*/, 'abab');
assertRegExp(/()*/, 'a');
assertRegExp(/(()*)*/, 'a');
assertRegExp(/a{1}/, 'a');

// ignoreCase tests
assertRegExp(/a/i, 'a');
assertRegExp(/a/i, 'A');
assertRegExp(/[a]/i, 'A');
assertRegExp(/[a]/i, 'a');
assertRegExp(/[ab]/i, 'Ab');
assertRegExp(/[ab]/i, 'aB');
assertRegExp(/[a-}]/i, 'A');
assertRegExp(/[a-}]/i, 'a');
assertRegExp(/[a-a]/i, 'A');
assertRegExp(/[a-a]/i, 'a');
assertRegExp(/[a-}]/i, '\\');  // Does not match.
a = String.fromCharCode(945);  // a
A = String.fromCharCode(913);  // Α
y = String.fromCharCode(947);  // γ
Y = String.fromCharCode(915);  // Γ
o = String.fromCharCode(969);  // ω
O = String.fromCharCode(937);  // Ω
assertRegExp(new RegExp(y, 'i'), y);
assertRegExp(new RegExp(y, 'i'), Y);
assertRegExp(new RegExp('[' + A + '-' + O + ']', 'i'), Y);  // /[Α-Ω]/i
assertRegExp(new RegExp('[' + a + '-' + o + ']', 'i'), y);  // /[Α-Ω]/i
assertRegExp(new RegExp('[' + a + '-' + o + ']', 'i'), y);  // /[Α-Ω]/i

// Parsing of non closing brackets (not defined in standard?)
assertRegExp(/]/, ']');
assertRegExp(/}/, '}');

console.log("failed:", failed);
if(failed) process.exit(1);