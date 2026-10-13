export const CATALOG_QUERY = `
  query Catalog($genre: String) {
    allArtists {
      id
      publicId
      name
      genre
      bio
      location
      albums {
        id
        title
        releaseDate
        coverImage
        tracks {
          id
          title
          audioFile
          playCount
          downloadCount
        }
      }
    }
    allProfiles {
      id
      publicId
      username
      displayName
      profileType
      bio
      location
      disciplines
      avatar
    }
    tracksByGenre(genre: $genre) {
      id
      title
      audioFile
      playCount
      downloadCount
      album {
        title
        artist {
          name
        }
      }
    }
    allWorks {
      id
      title
      workType
      description
      file
      thumbnail
      isPayable
      priceEtb
      playCount
      downloadCount
      creator {
        id
        publicId
        username
        displayName
        profileType
        bio
        location
        disciplines
        avatar
      }
    }
  }
`;
