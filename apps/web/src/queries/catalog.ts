const CREATOR_FIELDS = `
  id
  publicId
  username
  displayName
  profileType
  bio
  location
  disciplines
  avatar
`;

export const WORK_FIELDS = `
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
    ${CREATOR_FIELDS}
  }
`;

export const GET_WORK_QUERY = `query Work($id: ID!) { getWork(id: $id) { ${WORK_FIELDS} } }`;

export const CATALOG_QUERY = `
  query PopularCatalog($query: String, $workType: String, $creativeLimit: Int, $workLimit: Int, $searchLimit: Int) {
    popularCreatives(limit: $creativeLimit) {
      ${CREATOR_FIELDS}
    }
    loadPopularWorks(limit: $workLimit) {
      ${WORK_FIELDS}
    }
    searchWorks(query: $query, workType: $workType, limit: $searchLimit) {
      ${WORK_FIELDS}
    }
  }
`;

export const GET_CREATOR_QUERY = `
  query getCreatorQuery($publicId: String!) {
    getCreator(publicId: $publicId) {
      ${CREATOR_FIELDS}
      works {
        ${WORK_FIELDS}
      }
    }
  }
`;
