/* global module */

const RegexPattern = {
    Parentheses: '[()]',
    WhiteSpace: '\\s',
    Numbers: '[0-9]',
    Letters: '[a-zA-Z]',
    LeftParenthesis: '[(]'
};

/**
 Input LISP statement:
 (add 2 (subtract 4 2))

 Output Tokens:
 [
 { type: 'paren',  value: '('        },
 { type: 'name',   value: 'add'      },
 { type: 'number', value: '2'        },
 { type: 'paren',  value: '('        },
 { type: 'name',   value: 'subtract' },
 { type: 'number', value: '4'        },
 { type: 'number', value: '2'        },
 { type: 'paren',  value: ')'        },
 { type: 'paren',  value: ')'        },
 ]
 **/
function _tokenizer(input) {

    const NumbersRegExp = new RegExp(RegexPattern.Numbers);
    const LettersRegExp = new RegExp(RegexPattern.Letters);

    const TokenizerMap = {
        [RegexPattern.WhiteSpace]({current, tokens}) {
            return {
                current: ++current,
                tokens
            }
        },

        [RegexPattern.Parentheses]({char, current, tokens}) {
            tokens.push({
                type: 'paren',
                value: char
            });
            return {
                current: ++current,
                tokens
            };
        },

        [RegexPattern.Numbers]({char, current, tokens}) {
            let value = '';
            while (NumbersRegExp.test(char)) {
                value += char;
                char = input[++current];
            }
            tokens.push({
                type: 'number',
                value
            });
            return {
                current,
                tokens
            };
        },

        [RegexPattern.Letters]({char, current, tokens}) {
            let value = '';
            while (LettersRegExp.test(char)) {
                value += char;
                char = input[++current];
            }
            tokens.push({
                type: 'name',
                value
            });
            return {
                current,
                tokens
            };
        }
    };

    let current = 0;
    let tokens = [];

    while (current < input.length) {
        let char = input[current];
        let foundPattern = Object.keys(TokenizerMap).find(pattern => new RegExp(pattern).test(char));
        if (foundPattern) {
            let result = TokenizerMap[foundPattern]({char, current, tokens});
            current = result.current;
            tokens = result.tokens;
            continue;
        }
        throw new TypeError(`Unknown character: ${char}`);
    }

    return tokens;
}

/**
 Input Tokens:
 [
 { type: 'paren',  value: '('        },
 { type: 'name',   value: 'add'      },
 { type: 'number', value: '2'        },
 { type: 'paren',  value: '('        },
 { type: 'name',   value: 'subtract' },
 { type: 'number', value: '4'        },
 { type: 'number', value: '2'        },
 { type: 'paren',  value: ')'        },
 { type: 'paren',  value: ')'        },
 ]

 Output AST:
 {
     type: 'Program',
     body: [{
       type: 'CallExpression',
       name: 'add',
       params: [{
         type: 'NumberLiteral',
         value: '2',
       }, {
         type: 'CallExpression',
         name: 'subtract',
         params: [{
           type: 'NumberLiteral',
           value: '4',
         }, {
           type: 'NumberLiteral',
           value: '2',
         }]
       }]
     }]
}
 **/
function _parser(tokens) {
    const ParserMap = {
        [RegexPattern.Numbers]({value}) {
            current++;
            return {
                type: 'NumberLiteral',
                value
            };
        },

        [RegexPattern.LeftParenthesis]() {
            let token = tokens[++current];
            let node = {
                type: 'CallExpression',
                name: token.value,
                params: []
            };
            token = tokens[++current];
            while (token.value !== ')') {
                // Used Backtrack
                node.params.push(_walk());
                token = tokens[current];
            }
            current++;
            return node;
        }
    };

    let current = 0;

    function _walk() {
        let token = tokens[current];
        let foundPattern = Object.keys(ParserMap).find(pattern => new RegExp(pattern).test(token.value + ''));
        if (foundPattern) {
            return ParserMap[foundPattern](token);
        }
        throw new TypeError(`Unknown token: ${token.type}`);
    }

    let ast = {
        type: 'Program',
        body: []
    };

    while (current < tokens.length) {
        ast.body.push(_walk());
    }

    return ast;
}

/**
 ----------------------------------------------------------------------------
 Input AST                        |   Output AST
 ----------------------------------------------------------------------------
 {                                |   {
     type: 'Program',               |     type: 'Program',
     body: [{                       |     body: [{
       type: 'CallExpression',      |       type: 'ExpressionStatement',
       name: 'add',                 |       expression: {
       params: [{                   |         type: 'CallExpression',
         type: 'NumberLiteral',     |         callee: {
         value: '2'                 |           type: 'Identifier',
       }, {                         |           name: 'add'
         type: 'CallExpression',    |         },
         name: 'subtract',          |         arguments: [{
         params: [{                 |           type: '3',
           type: 'NumberLiteral',   |           value: '2'
           value: '4'               |         }, {
         }, {                       |           type: 'CallExpression',
           type: 'NumberLiteral',   |           callee: {
           value: '2'               |             type: 'Identifier',
         }]                         |             name: 'subtract'
       }]                           |           },
     }]                             |           arguments: [{
   }                                |             type: 'NumberLiteral',
                                    |             value: '4'
 ---------------------------------- |           }, {
                                    |             type: 'NumberLiteral',
                                    |             value: '2'
                                    |           }]
  (sorry the other one is longer.)  |         }
                                    |       }
                                    |     }]
                                    |   }
 ----------------------------------------------------------------------------
 **/
function _transformer(ast) {

    const TransformVisitor = {
        NumberLiteral: {
            enter({value}, parent) {
                parent._context.push({
                    type: 'NumberLiteral',
                    value
                });
            }
        },

        CallExpression: {
            enter(node, parent) {
                let expression = {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: node.name
                    },
                    arguments: []
                };

                // why set it up with _context?
                node._context = expression.arguments;

                if (parent.type !== 'CallExpression') {
                    expression = {
                        type: 'ExpressionStatement',
                        expression
                    };
                }

                // why set it up with _context?
                parent._context.push(expression);
            }
        }
    };

    const TraverseVisitor = {
        Program(node) {
            _traverseArray(node.body, node);
        },
        CallExpression(node) {
            _traverseArray(node.params, node);
        },
        NumberLiteral(node) {}
    };

    function _traverseNode(node, parent) {
        // 访问者模式
        let {enter} = TransformVisitor[node.type] || {};
        let traverse = TraverseVisitor[node.type];

        if (typeof enter === 'function') {
            enter(node, parent);
        }
        if (typeof traverse === 'function') {
            traverse(node);
        }
    }

    function _traverseArray(array, parent) {
        array.forEach(child => _traverseNode(child, parent));
    }

    let newAst = {
        type: 'Program',
        body: []
    };

    ast._context = newAst.body;

    _traverseNode(ast, null);

    return newAst;
}

/**
 Input Transformed AST:
 {
  type: 'Program',
  body: [{
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: {
        type: 'Identifier',
        name: 'add'
      },
      arguments: [{
        type: 'NumberLiteral',
        value: '2'
      }, {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'subtract'
        },
        arguments: [{
          type: 'NumberLiteral',
          value: '4'
        }, {
          type: 'NumberLiteral',
          value: '2'
        }]
      }
    }
  }]
}

 Output C statement:
 add(2, subtract(4, 2))
 **/
function _codeGenerator(node) {

    const GeneratorMap = {
        Program(node) {
            return node.body.map(_codeGenerator).join('\n');
        },
        ExpressionStatement(node) {
            return _codeGenerator(node.expression) + ';';
        },
        CallExpression(node) {
            return [_codeGenerator(node.callee), '(', node.arguments.map(_codeGenerator).join(', '), ')'].join('');
        },
        Identifier(node) {
            return node.name;
        },
        NumberLiteral(node) {
            return node.value;
        }
    };

    return GeneratorMap[node.type](node);
}

/** Wrapped Functions **/
function start(input) {
    return tokenizerFn => tokenizerFn && tokenizerFn(input);
}

function tokenizer(input) {
    let tokens = _tokenizer(input);
    return parserFn => parserFn && parserFn(tokens);
}

function parser(tokens) {
    let ast = _parser(tokens);
    return transformerFn => transformerFn && transformerFn(ast);
}

function transformer(ast) {
    let newAst = _transformer(ast);
    return codeGeneratorFn => codeGeneratorFn && codeGeneratorFn(newAst);
}

function codeGenerator(newAst) {
    return () => _codeGenerator(newAst);
}

function compiler(input) {
    // codeGenerator(transformer(parser(tokenizer())));
    return start(input)(tokenizer)(parser)(transformer)(codeGenerator)();
}

module.exports = {
    tokenizer: _tokenizer,
    parser: _parser,
    transformer: _transformer,
    codeGenerator: _codeGenerator,
    compiler
};