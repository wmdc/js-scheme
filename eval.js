/*
 * Scheme interpreter based on SICP
 */

(function (context, globalName, printFunction) {
    var jsScheme = {
	regex: {
	    // Identifiers are case insensitive. They may begin with the letters a-z
	    // or a character from the extended set, !$%&*+-./:<=>?@^_~
	    // Digits 0-9 may be used after the first character
	    identifier: /^[a-zA-Z!$%&*+-./:<=>?@^_~]+[a-zA-Z0-9!$%&*+-./:<=>?@^_~]$/,
	    singleLevelParen: /\([^)]*\)/g, // one level of paren matching
	    comment: /;/

	}
    };
    context[globalName] = jsScheme;

    function reduceArgs(reduceFunction, initialValue) {
	return function () {
	    return Array.prototype.slice.call(arguments)
		.reduce(reduceFunction, initialValue);
	};
    };

    jsScheme.builtIns = {
	'+': reduceArgs(function add (sum, n) { return sum + n; }, 0),
	// Provide initial value 0 to subtract for allow expressions like (- 2)
	'-': reduceArgs(function subtract (sum, n) { return sum - n; }, 0),
	'*': reduceArgs(function multiply (sum, n) { return sum * n; }, 1),
	'/': reduceArgs(function divide (sum, n) { return sum / n; }, 1),
	'=': function equals () {
	    if (arguments.length < 2) {
		throw 'Requires 2 or more arguments';
	    }
	    var v = arguments[0];
	    var equal = true;
	    Array.prototype.slice.call(arguments).forEach(function (item) {
		if(item !== v) { equal = false; }
	    });
	    return equal;
	},
	'>': function greaterThan(a, b) {
	    if (arguments.length !== 2) {
		throw 'Requires exactly 2 arguments';
	    }
	    if (isNaN(a) || isNaN(b)) {
		throw 'Both arguments must be numbers';
	    }
	    return a > b;
	},
	'<': function lessThan(a, b) {
	    if (arguments.length !== 2) {
		throw 'Requires exactly 2 arguments';
	    }
	    if (isNaN(a) || isNaN(b)) {
		throw 'Both arguments must be numbers';
	    }
	    return a < b;
	},
	'and': function and() {
	    // could be implemented from =
	    if (arguments.length < 2) {
		throw 'Requires 2 or more arguments';
	    }
	    var accum = true;
	    Array.prototype.slice.call(arguments).forEach(function (item) {
		if(typeof item !== 'boolean') {
		    throw 'Arguments must be booleans';
		}
		if (item !== true) { accum = false; }
	    });
	    return accum;
	},
	'or': function or() {
	    // could be implemented from =
	    if (arguments.length < 2) {
		throw 'Requires 2 or more arguments';
	    }
	    var accum = false;
	    Array.prototype.slice.call(arguments).forEach(function (item) {
		if(typeof item !== 'boolean') {
		    throw 'Arguments must be booleans';
		}
		if (item === true) { accum = true; }
	    });
	    return accum;
	},
	'not': function not() {
	    if (arguments.length !== 1) {
		throw 'Requires one argument';
	    }
	    if(typeof arguments[0] !== 'boolean') {
		throw 'Requires a single boolean as an argument';
	    }
	    return !arguments[0];
	}
    };

    /*
     * Create a new execution context
     */
    function _createContext (existingContext) {
	var f = new Function();
	f.prototype = existingContext || Object;
	return new f();
    };

    /*
     * The global context. Extends the built-in context
     */
    jsScheme.globalContext = _createContext(jsScheme.builtIns);
    // Put some stuff in the global context by default
    jsScheme.globalContext.pi = 3.14159;

    /*
     * Interpret a single token as a global, number, string, or boolean
     */
    function _interpretIdentifier(identifier, context) {
	if (context[identifier] !== undefined) {
	    var cVar  = context[identifier];

	    if (typeof cVar === 'function') {
		if(jsScheme.builtIns.hasOwnProperty(identifier)) {
		    throw 'Attempted to evaluate built-in procedure (JavaScript) "' + identifier +
			'"\n' + cVar;
		} else {
		    throw 'Attempted to evaluate built-in procedure (Scheme) "' + identifier +
			'"\n  Arguments: ' + cVar.args +
			'\n  Procedure: ' + JSON.stringify(cVar.procedure);
		}
	    } else {
		return cVar;
	    }
	} else { // literals
	    if (identifier === ':t') {
		return true;
	    }
	    if (identifier === ':f') {
		return false;
	    }
	    // N.B.: only support for numbers currently
	    if(identifier === 'NaN') {
		return NaN;
	    }
	    var result = Number(identifier);
	    if(isNaN(result)) {
		throw 'Unknown identifier: ' + identifier;
	    }
	    return result;
	}
    }

    function _treeEval(node, context) {
	// Single elements are considered identifiers
	if(!Array.isArray(node)) {
	    return _interpretIdentifier(node, context);
	}
	// Lists are not preceded by function names to be applied
	if(node.type === 'list') {
	    return node.map(function(child) { _interpretIdentifier(child, context); });
	}
	// Remaining case: s-expression with function to be applied to remaining children
	if(!node.length) {
	    throw 'Cannot execute empty expression!';
	}

	var fn = node[0];

	/* Special forms */

	// Define is a base special form. It can either map a single value onto a variable
	// name, or it can map a sequence of instructions onto a procedure name and execution
	// context defined by the arguments list.
	if (fn === 'define') {
	    var names = node[1];
	    var procedure = node[2];

	    if(Array.isArray(names)) {
		// Store a procedure to be evaluated
		var name = names[0];
		var procedureArgs = names.slice(1);
		// function bind to new context
		var newFn = function () {
		    // the function's context needs to have the argument values injected
		    var fnContext = _createContext(context);
		    var fnArguments = arguments;
		    procedureArgs.forEach(function(arg, index) {
			fnContext[arg] = fnArguments[index];
		    });
		    return _treeEval(procedure, fnContext);
		};
		newFn.name = name;
		newFn.args = procedureArgs;
		newFn.procedure = procedure;
		context[name] = newFn;
	    } else {
		// Fully evaluate and store in the context
		context[node[1]] = _treeEval(procedure, context);
	    }
	    return undefined;
	} else if (fn === 'cond') {
	    var pairs = node.slice(1);

	    for (var pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
		var pair = pairs[pairIndex];

		if (pairIndex === pairs.length - 1 && pair[0] === 'else') {
		    return _treeEval(pair[1], context);
		}

		if (pair.length !== 2) {
		    throw '"cond" requires pairs of predicates and expressions';
		}

		var test = _treeEval(pair[0], context);

		if (test === true) {
		    return _treeEval(pair[1], context);
		} else if (test !== false) {
		    throw '"cond" predicate did not evaluate to a boolean';
		}
	    }
	    throw 'Failed to evaluate "cond" conditions';
	} else if (fn === 'if') {
	    return (function () {
		if (node.length !== 4) {
		    throw '"if" special form requires three arguments';
		}
		var predicate = node[1];
		var consequent = node[2];
		var alternative = node[3];

		var test = _treeEval(predicate, context);

		if (test === true) {
		    return _treeEval(consequent, context);
		} else if (test === false) {
		    return _treeEval(alternative, context);
		} else {
		    throw '"if" predicate did not evaluate to a boolean';
		}
	    })();
	} else if (fn === 'cons') {
	    if (node.length < 3) {
		return '"cons" requires 3 or more arguments';
	    }

	    var result = [];
	    node.slice(1).forEach(function (expr) {
		result.push(_treeEval(expr, context));
	    });
	    return result;
	} else if(fn === 'cdr') {
	    if (node.length != 2) {
		throw '"cdr" requires exactly 1 argument';
	    }
	    var val = _treeEval(node[1], context);
	    if (!Array.isArray(val)) {
		throw '"cdr" argument must be a pair or list';
	    }
	    if (val.length < 2) {
		throw 'Value is not a pair or list with at least 2 elements';
	    }
	    return val[1];
	} else if (fn === 'car') {
	    return (function () {
		if (node.length != 2) {
		    throw '"car" requires exactly 1 argument';
		}
		var val = _treeEval(node[1], context);
		if (!Array.isArray(val)) {
		    throw '"car" argument must be a pair or list';
		}
		if (val.length < 2) {
		    throw 'Value is not a pair or list with at least 2 elements';
		}

		return val[0];
	    })();
	} else {
	    if(!context[fn]) {
		throw 'Unknown function name: ' + fn;
	    }
	    if(typeof context[fn] !== 'function') {
		throw 'Tried to apply a non-function: ' + fn;
	    }
	    // Prepare children
	    var args = node.slice(1).map(function(child) {
		return _treeEval(child, context);
	    });
	    // Apply the function
	    return context[fn].apply(context, args);
	}
    };

    /*
     * Constructs an AST out of a string and then evaluates it
     * Use the global context if no context is provided
     */
    jsScheme.eval = function eval(str, context) {
	context = context || jsScheme.globalContext;
	var tree = jsScheme.tree(str);
	return _treeEval(tree, context);
    };

    /*
     * Constructs an AST out of a string consisting of numbers,
     * string literals, and potentially nested s-expressions
     */
    jsScheme.tree = function tree(s) {
	var cur = undefined;
	var append = false;

	if(s[0] !== '(') {
	    return s;
	}

	s.split('').forEach(function(c) {
	    switch(c) {
	    case '\n':
		// ignore
		break;
	    case '(':
		var newNode = [cur];
		if(cur) {
		    cur.push(newNode);
		}
		cur = newNode;
		append = false;
		break;
	    case ')':
		if(cur[0]) {
		    var old = cur;
		    cur = cur[0];
		    old.shift(); // get rid of the old parent reference
		}
		append = false;
		break;
	    default:
		if(c.match(/[ ]/)) {
		    append = false; // start a new token
		    break;
		}
		append ? cur[cur.length - 1] += c : cur.push(c);
		append = true;
		break;
	    }
	});
	cur.shift();
	return cur;
    };
})(window, 'jsScheme', function printToTerminal () {
    var term = window.jQuery.terminal.active();
    term.echo.apply(term, arguments);
});
