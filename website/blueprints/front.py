# Python imports
import json

# Flask imports
from flask import Blueprint, g, request, url_for, abort, render_template, redirect, flash, current_app, jsonify

front = Blueprint('front', __name__)

@front.route('/', methods=['GET'])
def index():
    """ Home page """
    return render_template('front/index.html')
