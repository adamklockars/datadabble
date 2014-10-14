class Config(object):
    """ Production configuration! """

    # General
    DEBUG = False
    TESTING = False
    MONGODB_SETTINGS = {'DB': "datadabble"}
    SECRET_KEY = "KeepThisS3cr3t"

class DevelopmentConfig(Config):
    """ Development configuration! """
    DEBUG = True

class TestingConfig(Config):
    """ Testing configuration! """
    TESTING = True