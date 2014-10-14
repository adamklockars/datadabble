import datetime

from mongoengine import *
from flask import url_for
from datadabble import db

connect('datadabble')

class User(Document):
	created_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	updated_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	email = db.StringField(required=True)
	first_name = db.StringField(max_length=50)
	last_name = db.StringField(max_length=50)
	password = db.StringField(max_length=50)

class Database(Document):
	created_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	updated_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	title = db.StringField(max_length=120, required=True)
	slug = db.StringField(max_length=120, required=True)
	user = db.ReferenceField(User, reverse_delete_rule=CASCADE)

	def get_absolute_url(self):
		return url_for('post', kwargs={"slug": self.slug})

	def __unicode__(self):
		return self.title

	meta = {
		'allow_inheritance': True,
		'indexes': ['-created_at', 'slug'],
		'ordering': ['-created_at']
	}

FIELD_TYPE = (('BOOL', 'Boolean'),
			('INT', 'Integer'),
			('DEC', 'Decimal'),
			('STR', 'String'),
			('DATE', 'Date'),
			('EMAIL', 'Email'),
			('URL', 'URL'),
			('DICT', 'Dictionary'),
			('LIST', 'List'))

class Field(Document):
	created_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	updated_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	database = db.ReferenceField(Database, reverse_delete_rule=CASCADE)
	name = db.StringField(max_length=120)
	type = db.StringField(max_length=5, choices=FIELD_TYPE)

class Entry(Document):
	created_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	updated_at = db.DateTimeField(default=datetime.datetime.now(), required=True)
	database = db.ReferenceField(Database, reverse_delete_rule=CASCADE)
	values = db.DictField()
