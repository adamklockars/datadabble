import os
from website import create_app, register_blueprints
from flask.ext.mongoengine import MongoEngine

if os.getenv('PRODUCTION', False):
    app = create_app('website.config.Config')
else:
    app = create_app('website.config.DevelopmentConfig')

db = MongoEngine(app)

register_blueprints(app)

if __name__ == '__main__':
    """ Change to website.config.Config for deployment """
    app.run()
