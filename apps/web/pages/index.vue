<template>
  <div>
    <h1>Underground Catalog</h1>
    <div v-if="data">
      <ArtistCard 
        v-for="artist in data.allArtists" 
        :key="artist.id"
        :name="artist.name"
        :genre="artist.genre"
        :location="artist.location"
      />
    </div>
  </div>
</template>

<script setup>
const query = gql`
  query getArtists {
    allArtists {
      id
      name
      genre
      location
    }
  }
`
const { data } = await useAsyncQuery(query)
</script>
