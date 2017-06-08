'use strict'

const querystring = require('querystring')

const resolveRef = (ref, obj, parts) => {
  if (typeof parts === 'undefined') {
    parts = ref.split('/')
  }

  if (parts.length === 0) {
    return obj
  }

  let firstElement = parts.splice(0, 1)[0]
  if (firstElement === '#') {
    return resolveRef(ref, obj, parts)
  }
  if (firstElement in obj) {
    return resolveRef(ref, obj[firstElement], parts)
  } else {
    throw new Error(`could not resolve reference "${ref}"`)
  }
}

const getBaseUrl = (oas) => {
  // TODO: fix this...
  return oas.servers[0].url
}

const instantiatePath = (path, endpoint, args) => {
  // case: nothing to do
  if (!Array.isArray(endpoint.parameters)) {
    return path
  }

  let query = {}
  // iterate parameters:
  for (let i in endpoint.parameters) {
    let param = endpoint.parameters[i]

    // path parameters:
    if (param.in === 'path') {
      path = path.replace(`{${param.name}}`, args[param.name])
    }

    // query parameters:
    if (param.in === 'query' &&
      param.name in args) {
      query[param.name] = args[param.name]
    }
    path += querystring.stringify(query)

    // TODO: body...
  }
  return path
}

const getOperationById = (operationId, oas) => {
  for (let path in oas.paths) {
    for (let method in oas.paths[path]) {
      let endpoint = oas.paths[path][method]
      if (endpoint.operationId === operationId) {
        return {
          method: method,
          path: path,
          endpoint: endpoint
        }
      }
    }
  }
}

const getSchemaForOpId = (opId, oas) => {
  for (let path in oas.paths) {
    for (let method in oas.paths[path]) {
      let endpoint = oas.paths[path][method]
      if (endpoint.operationId === opId &&
        'responses' in endpoint &&
        '200' in endpoint.responses &&
        'content' in endpoint.responses['200'] &&
        'application/json' in endpoint.responses['200'].content &&
        'schema' in endpoint.responses['200'].content['application/json']) {
        // determine schema and name:
        let schema = endpoint.responses['200'].content['application/json'].schema
        if ('$ref' in schema) {
          schema = resolveRef(schema['$ref'], oas)
        }
        return schema
      }
    }
  }
  return null
}

const getSchemaType = (schema) => {
  if (typeof schema.type === 'string') {
    return schema.type
  }
  if ('properties' in schema) {
    return 'object'
  }
  if ('items' in schema) {
    return 'array'
  }
  return null
}

const inferResourceNameFromPath = (path) => {
  // TODO: try to be smarter about this!
  // For now: strip out any non-alphanumeric
  return path.replace(/[^a-zA-Z0-9 -]/g, '_')
}

const getEndpointLinks = (endpoint, oas) => {
  let links = {}
  if ('links' in endpoint.responses['200']) {
    for (let linkKey in endpoint.responses['200'].links) {
      let link = endpoint.responses['200'].links[linkKey]
      if ('$ref' in link) {
        link = resolveRef(link['$ref'], oas)
      }
      links[linkKey] = link
    }
  }
  return links
}

const getEndpointReqBodySchema = (endpoint, oas) => {
  if ('requestBody' in endpoint &&
    'content' in endpoint.requestBody &&
    'application/json' in endpoint.requestBody.content &&
    'schema' in endpoint.requestBody.content['application/json']) {
    let schema = endpoint.requestBody.content['application/json'].schema
    if ('$ref' in schema) {
      schema = resolveRef(schema['$ref'], oas)
    }
    return schema
  }
  return null
}

module.exports = {
  resolveRef,
  getBaseUrl,
  instantiatePath,
  getSchemaForOpId,
  getOperationById,
  getSchemaType,
  inferResourceNameFromPath,
  getEndpointLinks,
  getEndpointReqBodySchema
}
