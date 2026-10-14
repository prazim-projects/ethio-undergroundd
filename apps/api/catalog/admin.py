from django.contrib import admin
from .models import CreativeWork, CreatorProfile

admin.site.register(CreatorProfile)
admin.site.register(CreativeWork)
