"""Flask CLI commands."""
import click
from flask import Flask


def register_cli(app: Flask):
    """Register CLI commands with the Flask app."""

    @app.cli.group()
    def seed():
        """Database seed commands."""
        pass

    @seed.command("run")
    def seed_run():
        """Populate database with sample data."""
        from seed import run_seed
        run_seed()
        click.echo("Seed data created successfully.")

    @seed.command("clean")
    def seed_clean():
        """Remove all seed data."""
        from seed import clean_seed
        clean_seed()
        click.echo("Seed data removed successfully.")
