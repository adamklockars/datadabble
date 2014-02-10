class Config(object):
    """ Production configuration! """

    # General
    DEBUG = False
    TESTING = False
    SECRET_KEY = 'write_secret_key_here'

class DevelopmentConfig(Config):
    """ Development configuration! """
    DEBUG = True

class TestingConfig(Config):
    """ Testing configuration! """
    TESTING = True