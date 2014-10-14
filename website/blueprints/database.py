from flask import Blueprint, request, redirect, render_template, url_for
from flask.views import MethodView
from datadabble.website.models import Database

dbs = Blueprint('dbs', __name__, template_folder='templates')


class ListView(MethodView):

    def get(self):
        dbs = Databases.objects(user=request.user)
        return [db.__json__() for db in dbs]


class DetailView(MethodView):

    def get(self, slug):
        db = Database.objects.get_or_404(slug=slug)
        return db.__json__()


# Register the urls
dbs.add_url_rule('/', view_func=ListView.as_view('list'))
dbs.add_url_rule('/<slug>/', view_func=DetailView.as_view('detail'))