import graphene
from graphene_django import DjangoObjectType
from catalog.models import Album, Artist, CreativeWork, CreatorProfile, Track

class ArtistType(DjangoObjectType):
    class Meta:
        model = Artist
        fields = "__all__"

class AlbumType(DjangoObjectType):
    class Meta:
        model = Album
        fields = "__all__"


class TrackType(DjangoObjectType):
    class Meta:
        model = Track
        fields = "__all__"


class CreatorProfileType(DjangoObjectType):
    class Meta:
        model = CreatorProfile
        fields = "__all__"


class CreativeWorkType(DjangoObjectType):
    class Meta:
        model = CreativeWork
        fields = "__all__"


class Query(graphene.ObjectType):
    all_artists = graphene.List(ArtistType)
    all_profiles = graphene.List(CreatorProfileType)
    artist_detail = graphene.Field(ArtistType, id=graphene.ID(required=True))
    tracks_by_genre = graphene.List(TrackType, genre=graphene.String())
    all_works = graphene.List(CreativeWorkType, work_type=graphene.String())
    current_creator = graphene.Field(CreatorProfileType)

    def resolve_all_artists(self, info):
        return Artist.objects.all()

    def resolve_all_profiles(self, info):
        return CreatorProfile.objects.prefetch_related("works").all()

    def resolve_artist_detail(self, info, id):
        return Artist.objects.filter(pk=id).first()

    def resolve_tracks_by_genre(self, info, genre):
        tracks = Track.objects.select_related("album", "album__artist").all()
        return tracks.filter(album__artist__genre__iexact=genre) if genre else tracks

    def resolve_all_works(self, info, work_type=None):
        works = CreativeWork.objects.select_related("creator", "creator__user").filter(published=True)
        return works.filter(work_type=work_type) if work_type else works

    def resolve_current_creator(self, info):
        if not info.context.user.is_authenticated:
            return None
        return CreatorProfile.objects.filter(user=info.context.user).first()

schema = graphene.Schema(query=Query)
