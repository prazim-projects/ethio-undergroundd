from django.db import models


class Artist(models.Model):
    name = models.CharField(max_length=200)
    genre = models.CharField(max_length=100)
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=120)

    def __str__(self) -> str:
        return self.name


class Album(models.Model):
    artist = models.ForeignKey(Artist, related_name="albums", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    release_date = models.DateField()
    cover_image = models.ImageField(upload_to="covers/", null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.title} ({self.artist.name})"


class Track(models.Model):
    album = models.ForeignKey(Album, related_name="tracks", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    audio_file = models.FileField(upload_to="tracks/")

    def __str__(self) -> str:
        return f"{self.title} - {self.album.title}"
