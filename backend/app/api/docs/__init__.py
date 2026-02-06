"""Swagger UI blueprint for API documentation."""
import os
from flask import Blueprint, send_from_directory

docs_bp = Blueprint("docs", __name__)

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))


@docs_bp.route("/")
def swagger_ui():
    """Serve Swagger UI page."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DataDabble API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html {{ box-sizing: border-box; overflow-y: scroll; }}
    *, *::before, *::after {{ box-sizing: inherit; }}
    body {{ margin: 0; background: #fafafa; }}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({{
      url: "/api/docs/openapi.yaml",
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: "BaseLayout",
    }});
  </script>
</body>
</html>"""


@docs_bp.route("/openapi.yaml")
def openapi_spec():
    """Serve the OpenAPI specification file."""
    return send_from_directory(DOCS_DIR, "openapi.yaml", mimetype="text/yaml")
