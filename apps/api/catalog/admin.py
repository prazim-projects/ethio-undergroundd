from django.contrib import admin
from .models import Album, Artist, CreativeWork, CreatorProfile, Track

admin.site.register(Artist)
admin.site.register(Album)
admin.site.register(Track)
admin.site.register(CreatorProfile)
admin.site.register(CreativeWork)
