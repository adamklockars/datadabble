"""AI-powered insights and Q&A endpoints."""
import json
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, current_user

from app.api.v1 import api_v1
from app.models import Database, Field, Entry


def get_database_or_404(slug):
    """Get database owned by current user or return 404."""
    database = Database.objects(user=current_user, slug=slug).first()
    if not database:
        return None
    return database


def get_database_context(database, fields, entries, max_entries=50):
    """Build context string describing the database schema and sample data."""
    context_parts = []

    # Database info
    context_parts.append(f"Database: {database.title}")
    if database.description:
        context_parts.append(f"Description: {database.description}")

    # Schema
    context_parts.append(f"\nSchema ({len(fields)} fields):")
    sorted_fields = sorted(fields, key=lambda f: f.order)
    for field in sorted_fields:
        req = "required" if field.required else "optional"
        context_parts.append(f"  - {field.name} ({field.field_type}, {req})")

    # Sample data
    sample_entries = entries[:max_entries]
    context_parts.append(f"\nData ({len(entries)} total entries, showing {len(sample_entries)}):")

    if sample_entries:
        for i, entry in enumerate(sample_entries):
            values = []
            for field in sorted_fields:
                val = entry.values.get(field.name)
                if val is not None:
                    # Truncate long values
                    str_val = str(val)
                    if len(str_val) > 100:
                        str_val = str_val[:100] + "..."
                    values.append(f"{field.name}={str_val}")
            context_parts.append(f"  {i+1}. {', '.join(values)}")
    else:
        context_parts.append("  (no entries yet)")

    return "\n".join(context_parts)


def get_anthropic_client():
    """Get Anthropic client if API key is configured."""
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception:
        return None


@api_v1.route("/databases/<slug>/ai/insights", methods=["POST"])
@jwt_required()
def get_insights(slug):
    """Generate AI-powered insights about the database."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    client = get_anthropic_client()
    if not client:
        return jsonify({"error": "AI features not configured. Please set ANTHROPIC_API_KEY."}), 503

    fields = list(Field.objects(database=database).order_by("order", "-created_at"))
    entries = list(Entry.objects(database=database).order_by("-created_at"))

    if not fields:
        return jsonify({"error": "No fields defined in this database"}), 400

    context = get_database_context(database, fields, entries)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this database and provide useful insights. Focus on:
1. Data patterns and trends
2. Potential data quality issues (missing values, inconsistencies)
3. Suggestions for additional fields or improvements
4. Summary statistics where applicable

Be concise and actionable. Use bullet points.

{context}"""
                }
            ]
        )

        insights = message.content[0].text
        return jsonify({"insights": insights}), 200

    except Exception as e:
        return jsonify({"error": f"AI request failed: {str(e)}"}), 500


@api_v1.route("/databases/<slug>/ai/ask", methods=["POST"])
@jwt_required()
def ask_question(slug):
    """Answer a question about the database using AI."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    client = get_anthropic_client()
    if not client:
        return jsonify({"error": "AI features not configured. Please set ANTHROPIC_API_KEY."}), 503

    data = request.get_json()
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "Question is required"}), 400

    if len(question) > 1000:
        return jsonify({"error": "Question too long (max 1000 characters)"}), 400

    fields = list(Field.objects(database=database).order_by("order", "-created_at"))
    entries = list(Entry.objects(database=database).order_by("-created_at"))

    context = get_database_context(database, fields, entries)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": f"""You are a helpful data assistant. Answer the user's question about this database.
Be concise and accurate. If you can't answer based on the available data, say so.

{context}

User's question: {question}"""
                }
            ]
        )

        answer = message.content[0].text
        return jsonify({"answer": answer}), 200

    except Exception as e:
        return jsonify({"error": f"AI request failed: {str(e)}"}), 500


@api_v1.route("/databases/<slug>/ai/suggest-query", methods=["POST"])
@jwt_required()
def suggest_query(slug):
    """Suggest a database query based on natural language."""
    database = get_database_or_404(slug)
    if not database:
        return jsonify({"error": "Database not found"}), 404

    client = get_anthropic_client()
    if not client:
        return jsonify({"error": "AI features not configured. Please set ANTHROPIC_API_KEY."}), 503

    data = request.get_json()
    description = data.get("description", "").strip()

    if not description:
        return jsonify({"error": "Query description is required"}), 400

    fields = list(Field.objects(database=database).order_by("order", "-created_at"))

    # Build schema context
    schema_parts = [f"Table: {database.title.lower().replace(' ', '_')}"]
    for field in sorted(fields, key=lambda f: f.order):
        schema_parts.append(f"  - {field.name} ({field.field_type})")

    schema = "\n".join(schema_parts)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": f"""Given this database schema, write a MongoDB query (using pymongo syntax) for the following request.
Return ONLY the query as valid Python code, no explanation.

Schema:
{schema}

Request: {description}"""
                }
            ]
        )

        query = message.content[0].text
        return jsonify({"query": query}), 200

    except Exception as e:
        return jsonify({"error": f"AI request failed: {str(e)}"}), 500
