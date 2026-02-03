"""Filter expression parser for database entries.

Expression Language:
  - Comparisons: field = value, field != value, field > value, field < value, field >= value, field <= value
  - Text operations: field contains "text", field startswith "text", field endswith "text"
  - Null checks: field is null, field is not null
  - Empty checks: field is empty, field is not empty
  - Boolean: AND, OR (case insensitive)
  - Grouping: parentheses ()
  - Values: "quoted strings", numbers, true, false

Examples:
  - status = "active"
  - age > 18 AND age < 65
  - name contains "john" OR email contains "john"
  - (status = "active" OR status = "pending") AND created_at > "2024-01-01"
  - price >= 100 AND price <= 500
  - description is not empty
"""

import re
from typing import Any, Dict, List, Tuple, Optional


class FilterParseError(Exception):
    """Raised when filter expression parsing fails."""
    pass


class Token:
    """Token types for the lexer."""
    FIELD = "FIELD"
    STRING = "STRING"
    NUMBER = "NUMBER"
    BOOLEAN = "BOOLEAN"
    NULL = "NULL"
    OPERATOR = "OPERATOR"
    LOGIC = "LOGIC"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    KEYWORD = "KEYWORD"
    EOF = "EOF"


class Lexer:
    """Tokenize filter expressions."""

    OPERATORS = {"=", "!=", ">", "<", ">=", "<="}
    KEYWORDS = {"contains", "startswith", "endswith", "is", "not", "empty", "null"}
    LOGIC = {"and", "or"}

    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        self.length = len(text)

    def peek(self) -> Optional[str]:
        if self.pos < self.length:
            return self.text[self.pos]
        return None

    def advance(self) -> Optional[str]:
        if self.pos < self.length:
            char = self.text[self.pos]
            self.pos += 1
            return char
        return None

    def skip_whitespace(self):
        while self.pos < self.length and self.text[self.pos].isspace():
            self.pos += 1

    def read_string(self) -> str:
        quote = self.advance()  # consume opening quote
        result = []
        while self.pos < self.length:
            char = self.advance()
            if char == quote:
                return "".join(result)
            if char == "\\":
                next_char = self.advance()
                if next_char:
                    result.append(next_char)
            else:
                result.append(char)
        raise FilterParseError("Unterminated string")

    def read_number(self) -> float:
        start = self.pos
        has_dot = False
        while self.pos < self.length:
            char = self.text[self.pos]
            if char.isdigit():
                self.pos += 1
            elif char == "." and not has_dot:
                has_dot = True
                self.pos += 1
            elif char == "-" and self.pos == start:
                self.pos += 1
            else:
                break
        return float(self.text[start:self.pos])

    def read_identifier(self) -> str:
        start = self.pos
        while self.pos < self.length:
            char = self.text[self.pos]
            if char.isalnum() or char in "_-.":
                self.pos += 1
            else:
                break
        return self.text[start:self.pos]

    def tokenize(self) -> List[Tuple[str, Any]]:
        tokens = []
        while self.pos < self.length:
            self.skip_whitespace()
            if self.pos >= self.length:
                break

            char = self.peek()

            # Parentheses
            if char == "(":
                self.advance()
                tokens.append((Token.LPAREN, "("))
            elif char == ")":
                self.advance()
                tokens.append((Token.RPAREN, ")"))

            # Strings
            elif char in "\"'":
                tokens.append((Token.STRING, self.read_string()))

            # Numbers
            elif char.isdigit() or (char == "-" and self.pos + 1 < self.length and self.text[self.pos + 1].isdigit()):
                tokens.append((Token.NUMBER, self.read_number()))

            # Operators
            elif char in "=!><":
                op = self.advance()
                if self.peek() == "=":
                    op += self.advance()
                if op in self.OPERATORS:
                    tokens.append((Token.OPERATOR, op))
                else:
                    raise FilterParseError(f"Unknown operator: {op}")

            # Identifiers, keywords, logic
            elif char.isalpha() or char == "_":
                ident = self.read_identifier()
                lower = ident.lower()
                if lower in self.LOGIC:
                    tokens.append((Token.LOGIC, lower))
                elif lower in self.KEYWORDS:
                    tokens.append((Token.KEYWORD, lower))
                elif lower == "true":
                    tokens.append((Token.BOOLEAN, True))
                elif lower == "false":
                    tokens.append((Token.BOOLEAN, False))
                else:
                    tokens.append((Token.FIELD, ident))
            else:
                raise FilterParseError(f"Unexpected character: {char}")

        tokens.append((Token.EOF, None))
        return tokens


class Parser:
    """Parse tokens into a filter AST."""

    def __init__(self, tokens: List[Tuple[str, Any]]):
        self.tokens = tokens
        self.pos = 0

    def current(self) -> Tuple[str, Any]:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else (Token.EOF, None)

    def advance(self) -> Tuple[str, Any]:
        token = self.current()
        self.pos += 1
        return token

    def expect(self, token_type: str) -> Any:
        tok_type, tok_val = self.current()
        if tok_type != token_type:
            raise FilterParseError(f"Expected {token_type}, got {tok_type}")
        self.advance()
        return tok_val

    def parse(self) -> Dict:
        """Parse the expression and return AST."""
        if self.current()[0] == Token.EOF:
            return {"type": "empty"}
        result = self.parse_or()
        if self.current()[0] != Token.EOF:
            raise FilterParseError(f"Unexpected token: {self.current()}")
        return result

    def parse_or(self) -> Dict:
        left = self.parse_and()
        while self.current() == (Token.LOGIC, "or"):
            self.advance()
            right = self.parse_and()
            left = {"type": "or", "left": left, "right": right}
        return left

    def parse_and(self) -> Dict:
        left = self.parse_primary()
        while self.current() == (Token.LOGIC, "and"):
            self.advance()
            right = self.parse_primary()
            left = {"type": "and", "left": left, "right": right}
        return left

    def parse_primary(self) -> Dict:
        tok_type, tok_val = self.current()

        # Parenthesized expression
        if tok_type == Token.LPAREN:
            self.advance()
            expr = self.parse_or()
            self.expect(Token.RPAREN)
            return expr

        # Field comparison
        if tok_type == Token.FIELD:
            field = self.advance()[1]
            return self.parse_comparison(field)

        raise FilterParseError(f"Unexpected token: {tok_type} {tok_val}")

    def parse_comparison(self, field: str) -> Dict:
        tok_type, tok_val = self.current()

        # Standard operators: =, !=, >, <, >=, <=
        if tok_type == Token.OPERATOR:
            op = self.advance()[1]
            value = self.parse_value()
            return {"type": "comparison", "field": field, "operator": op, "value": value}

        # Text operators: contains, startswith, endswith
        if tok_type == Token.KEYWORD and tok_val in ("contains", "startswith", "endswith"):
            op = self.advance()[1]
            value = self.parse_value()
            return {"type": "comparison", "field": field, "operator": op, "value": value}

        # IS NULL / IS NOT NULL / IS EMPTY / IS NOT EMPTY
        if tok_type == Token.KEYWORD and tok_val == "is":
            self.advance()
            tok_type2, tok_val2 = self.current()

            # IS NOT ...
            if tok_type2 == Token.KEYWORD and tok_val2 == "not":
                self.advance()
                tok_type3, tok_val3 = self.current()
                if tok_type3 == Token.KEYWORD and tok_val3 == "null":
                    self.advance()
                    return {"type": "comparison", "field": field, "operator": "is_not_null", "value": None}
                elif tok_type3 == Token.KEYWORD and tok_val3 == "empty":
                    self.advance()
                    return {"type": "comparison", "field": field, "operator": "is_not_empty", "value": None}
                else:
                    raise FilterParseError(f"Expected 'null' or 'empty' after 'is not'")

            # IS NULL / IS EMPTY
            if tok_type2 == Token.KEYWORD and tok_val2 == "null":
                self.advance()
                return {"type": "comparison", "field": field, "operator": "is_null", "value": None}
            elif tok_type2 == Token.KEYWORD and tok_val2 == "empty":
                self.advance()
                return {"type": "comparison", "field": field, "operator": "is_empty", "value": None}
            else:
                raise FilterParseError(f"Expected 'null', 'not', or 'empty' after 'is'")

        raise FilterParseError(f"Expected operator after field '{field}'")

    def parse_value(self) -> Any:
        tok_type, tok_val = self.current()
        if tok_type in (Token.STRING, Token.NUMBER, Token.BOOLEAN):
            self.advance()
            return tok_val
        raise FilterParseError(f"Expected value, got {tok_type}")


def parse_filter(expression: str) -> Dict:
    """Parse a filter expression string into an AST."""
    if not expression or not expression.strip():
        return {"type": "empty"}
    lexer = Lexer(expression)
    tokens = lexer.tokenize()
    parser = Parser(tokens)
    return parser.parse()


def ast_to_mongo_query(ast: Dict, field_types: Dict[str, str] = None) -> Dict:
    """Convert filter AST to MongoDB query."""
    field_types = field_types or {}

    def convert_value(field: str, value: Any) -> Any:
        """Convert value based on field type."""
        ftype = field_types.get(field, "STR")
        if value is None:
            return None
        if ftype == "INT":
            try:
                return int(value)
            except (ValueError, TypeError):
                return value
        elif ftype == "DEC":
            try:
                return float(value)
            except (ValueError, TypeError):
                return value
        elif ftype == "BOOL":
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ("true", "1", "yes")
            return bool(value)
        return value

    def build_query(node: Dict) -> Dict:
        node_type = node.get("type")

        if node_type == "empty":
            return {}

        if node_type == "and":
            left = build_query(node["left"])
            right = build_query(node["right"])
            return {"$and": [left, right]}

        if node_type == "or":
            left = build_query(node["left"])
            right = build_query(node["right"])
            return {"$or": [left, right]}

        if node_type == "comparison":
            field = node["field"]
            op = node["operator"]
            value = convert_value(field, node["value"])
            field_key = f"values.{field}"

            if op == "=":
                return {field_key: value}
            elif op == "!=":
                return {field_key: {"$ne": value}}
            elif op == ">":
                return {field_key: {"$gt": value}}
            elif op == "<":
                return {field_key: {"$lt": value}}
            elif op == ">=":
                return {field_key: {"$gte": value}}
            elif op == "<=":
                return {field_key: {"$lte": value}}
            elif op == "contains":
                return {field_key: {"$regex": re.escape(str(value)), "$options": "i"}}
            elif op == "startswith":
                return {field_key: {"$regex": f"^{re.escape(str(value))}", "$options": "i"}}
            elif op == "endswith":
                return {field_key: {"$regex": f"{re.escape(str(value))}$", "$options": "i"}}
            elif op == "is_null":
                return {field_key: None}
            elif op == "is_not_null":
                return {field_key: {"$ne": None}}
            elif op == "is_empty":
                return {"$or": [{field_key: None}, {field_key: ""}, {field_key: {"$exists": False}}]}
            elif op == "is_not_empty":
                return {"$and": [{field_key: {"$ne": None}}, {field_key: {"$ne": ""}}, {field_key: {"$exists": True}}]}

        return {}

    return build_query(ast)


def filter_entries(expression: str, field_types: Dict[str, str] = None) -> Dict:
    """Parse expression and return MongoDB query dict."""
    ast = parse_filter(expression)
    return ast_to_mongo_query(ast, field_types)
