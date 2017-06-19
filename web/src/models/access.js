import Cloudant from 'cloudant'
import uuid from 'uuid'
import { getCredentials } from '../bluemix/config'
import { today, tomorrow } from './frequency'

const dbName = 'access'
const credentials = getCredentials('cloudantNoSQLDB')

const cloudant = Cloudant({
  account: credentials.username,
  password: credentials.password,
  plugin: 'promises'  // Using the promises plugin to allow use of async/await
})

// Create the access database (storing codes/tokens) and establishing its indexes
export async function createAccessDb() {
  const dbs = await cloudant.db.list()
  if (dbs.includes(dbName)) {
    console.info('Database already exists: %s', dbName)
  } else {
    console.info('Creating database: %s', dbName)
    await cloudant.db.create(dbName)
  }
  const accessDb = cloudant.db.use(dbName)

  // Index corresponds to the search which includes (where not used and expiresAt < now)
  await accessDb.index({
    name: 'oneTimePassword',
    type: 'json',
    index: {
      fields: [
        'used',
        'expiresAt'
      ]
    }
  })

  return accessDb
}

export async function createCode(email) {
  const accessDb = cloudant.db.use(dbName)

  // The code's _id becomes the secret shared to the front-end
  const code = await accessDb.insert({
      used: false,
      email: email,
      expiresAt: tomorrow()
    },
    uuid.v4())

  return code.id
}

export async function useCode(codeId) {
  const accessDb = cloudant.db.use(dbName)

  const code = await accessDb.get(codeId)
  if (code.used || code.expiresAt < today()) {
    console.error('Tried to use an already used code: %s', JSON.stringify(code))
    throw new Error('Invalid code error')
  }

  return code.email
}
