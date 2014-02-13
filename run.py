from website import create_app
import os

if os.getenv('PRODUCTION', False):
    app = create_app('website.config.Config')
else:
    app = create_app('website.config.DevelopmentConfig')

if __name__ == '__main__':
    """ Change to website.config.Config for deployment """
    app.run()