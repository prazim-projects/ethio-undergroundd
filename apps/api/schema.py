import graphene
from graphene_django import DjangoObjectType
from catalog.models import Album, Artist, Track

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


class Query(graphene.ObjectType):
    all_artists = graphene.List(ArtistType)
    artist_detail = graphene.Field(ArtistType, id=graphene.ID(required=True))
    tracks_by_genre = graphene.List(TrackType, genre=graphene.String(required=True))

    def resolve_all_artists(self, info):
        return Artist.objects.all()

    def resolve_artist_detail(self, info, id):
        return Artist.objects.filter(pk=id).first()

    def resolve_tracks_by_genre(self, info, genre):
        return Track.objects.filter(album__artist__genre__iexact=genre)

schema = graphene.Schema(query=Query)
