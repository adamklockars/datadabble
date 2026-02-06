"""Tests for the filter parser module (app.api.v1.filter_parser)."""
import re
import pytest

from app.api.v1.filter_parser import (
    Lexer,
    Token,
    Parser,
    FilterParseError,
    parse_filter,
    ast_to_mongo_query,
    filter_entries,
)


# ---------------------------------------------------------------------------
# Lexer tests
# ---------------------------------------------------------------------------

class TestLexer:
    """Tests for tokenizing filter expressions."""

    def test_tokenize_simple_comparison(self):
        """Tokenizes a simple field = value expression."""
        tokens = Lexer('status = "active"').tokenize()
        assert tokens[0] == (Token.FIELD, "status")
        assert tokens[1] == (Token.OPERATOR, "=")
        assert tokens[2] == (Token.STRING, "active")
        assert tokens[3] == (Token.EOF, None)

    def test_tokenize_with_and_or(self):
        """Tokenizes an expression with AND and OR operators."""
        tokens = Lexer('age > 18 AND name = "John" OR active = true').tokenize()
        types = [t[0] for t in tokens]
        assert Token.LOGIC in types
        logic_tokens = [(t[0], t[1]) for t in tokens if t[0] == Token.LOGIC]
        assert (Token.LOGIC, "and") in logic_tokens
        assert (Token.LOGIC, "or") in logic_tokens

    def test_tokenize_quoted_strings(self):
        """Correctly tokenizes double-quoted and single-quoted strings."""
        tokens_dq = Lexer('name = "hello world"').tokenize()
        assert tokens_dq[2] == (Token.STRING, "hello world")

        tokens_sq = Lexer("name = 'hello world'").tokenize()
        assert tokens_sq[2] == (Token.STRING, "hello world")

    def test_tokenize_numbers(self):
        """Tokenizes integer and decimal numbers."""
        tokens = Lexer("price >= 9.99").tokenize()
        assert tokens[0] == (Token.FIELD, "price")
        assert tokens[1] == (Token.OPERATOR, ">=")
        assert tokens[2] == (Token.NUMBER, 9.99)

    def test_unexpected_character_error(self):
        """Raises FilterParseError for invalid characters."""
        with pytest.raises(FilterParseError, match="Unexpected character"):
            Lexer("status @ active").tokenize()


# ---------------------------------------------------------------------------
# Parser tests
# ---------------------------------------------------------------------------

class TestParser:
    """Tests for parsing tokens into an AST."""

    def test_parse_simple_comparison(self):
        """Parses a simple field = value into a comparison AST node."""
        ast = parse_filter('status = "active"')
        assert ast["type"] == "comparison"
        assert ast["field"] == "status"
        assert ast["operator"] == "="
        assert ast["value"] == "active"

    def test_parse_and_expression(self):
        """Parses an AND expression into a nested AST."""
        ast = parse_filter('age > 18 AND age < 65')
        assert ast["type"] == "and"
        assert ast["left"]["type"] == "comparison"
        assert ast["left"]["operator"] == ">"
        assert ast["right"]["type"] == "comparison"
        assert ast["right"]["operator"] == "<"

    def test_parse_or_expression(self):
        """Parses an OR expression into a nested AST."""
        ast = parse_filter('name = "Alice" OR name = "Bob"')
        assert ast["type"] == "or"
        assert ast["left"]["value"] == "Alice"
        assert ast["right"]["value"] == "Bob"

    def test_parse_nested_parentheses(self):
        """Parses parenthesized sub-expressions correctly."""
        ast = parse_filter('(status = "active" OR status = "pending") AND age > 21')
        assert ast["type"] == "and"
        assert ast["left"]["type"] == "or"
        assert ast["right"]["field"] == "age"

    def test_parse_is_null(self):
        """Parses IS NULL into an is_null comparison."""
        ast = parse_filter("description is null")
        assert ast["type"] == "comparison"
        assert ast["field"] == "description"
        assert ast["operator"] == "is_null"
        assert ast["value"] is None

    def test_parse_is_not_empty(self):
        """Parses IS NOT EMPTY into an is_not_empty comparison."""
        ast = parse_filter("title is not empty")
        assert ast["type"] == "comparison"
        assert ast["field"] == "title"
        assert ast["operator"] == "is_not_empty"
        assert ast["value"] is None

    def test_parse_contains(self):
        """Parses CONTAINS into a contains comparison."""
        ast = parse_filter('email contains "example"')
        assert ast["type"] == "comparison"
        assert ast["field"] == "email"
        assert ast["operator"] == "contains"
        assert ast["value"] == "example"


# ---------------------------------------------------------------------------
# ast_to_mongo_query tests
# ---------------------------------------------------------------------------

class TestAstToMongoQuery:
    """Tests for converting AST to MongoDB queries."""

    def test_simple_equality(self):
        """Equality comparison becomes {values.field: value}."""
        ast = parse_filter('status = "active"')
        query = ast_to_mongo_query(ast)
        assert query == {"values.status": "active"}

    def test_not_equal(self):
        """Not-equal comparison becomes $ne."""
        ast = parse_filter('status != "deleted"')
        query = ast_to_mongo_query(ast)
        assert query == {"values.status": {"$ne": "deleted"}}

    def test_greater_than(self):
        """Greater-than comparison becomes $gt."""
        ast = parse_filter("age > 18")
        query = ast_to_mongo_query(ast)
        assert query == {"values.age": {"$gt": 18.0}}

    def test_contains_regex(self):
        """Contains generates a case-insensitive regex query."""
        ast = parse_filter('name contains "john"')
        query = ast_to_mongo_query(ast)
        assert "values.name" in query
        assert "$regex" in query["values.name"]
        assert query["values.name"]["$options"] == "i"
        # The regex should match the escaped literal
        assert re.search(query["values.name"]["$regex"], "John Smith", re.IGNORECASE)

    def test_is_null(self):
        """IS NULL produces {values.field: None}."""
        ast = parse_filter("notes is null")
        query = ast_to_mongo_query(ast)
        assert query == {"values.notes": None}

    def test_and_combination(self):
        """AND produces $and with two sub-queries."""
        ast = parse_filter('status = "active" AND age > 21')
        query = ast_to_mongo_query(ast)
        assert "$and" in query
        assert len(query["$and"]) == 2

    def test_or_combination(self):
        """OR produces $or with two sub-queries."""
        ast = parse_filter('role = "admin" OR role = "manager"')
        query = ast_to_mongo_query(ast)
        assert "$or" in query
        assert len(query["$or"]) == 2

    def test_type_conversion_int(self):
        """INT field type converts string value to integer."""
        ast = parse_filter("quantity = 42")
        query = ast_to_mongo_query(ast, field_types={"quantity": "INT"})
        assert query == {"values.quantity": 42}
        assert isinstance(query["values.quantity"], int)

    def test_type_conversion_dec(self):
        """DEC field type converts value to float."""
        ast = parse_filter("price = 19.99")
        query = ast_to_mongo_query(ast, field_types={"price": "DEC"})
        assert query == {"values.price": 19.99}
        assert isinstance(query["values.price"], float)

    def test_type_conversion_bool(self):
        """BOOL field type converts value to boolean."""
        ast = parse_filter("active = true")
        query = ast_to_mongo_query(ast, field_types={"active": "BOOL"})
        assert query == {"values.active": True}
        assert isinstance(query["values.active"], bool)


# ---------------------------------------------------------------------------
# End-to-end test
# ---------------------------------------------------------------------------

class TestFilterEntries:
    """End-to-end test for filter_entries function."""

    def test_filter_entries_full_pipeline(self):
        """Parses expression and returns MongoDB query dict end-to-end."""
        query = filter_entries(
            'status = "active" AND priority > 3',
            field_types={"priority": "INT"},
        )
        assert "$and" in query
        left, right = query["$and"]
        assert left == {"values.status": "active"}
        assert right == {"values.priority": {"$gt": 3}}

    def test_filter_entries_empty_expression(self):
        """Empty expression returns an empty query dict."""
        query = filter_entries("")
        assert query == {}

    def test_filter_entries_none_expression(self):
        """None expression returns an empty query dict."""
        query = filter_entries(None)
        assert query == {}
