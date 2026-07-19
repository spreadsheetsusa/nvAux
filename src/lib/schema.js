export const schema = {
  version: 0,
  title: 'Note Schema',
  description: 'a single note object',
  primaryKey: 'guid',
  type: 'object',
  indexes: [
    'createdAt',
    'updatedAt'
  ],
  properties: {
    guid: {
      type: 'string',
      maxLength: 42,
      "description": "unique identifier for note"
    },
    name: {
      type: 'string',
      "description": "name/title of note"
    },
    body: {
      type: 'string',
      "description": "markdown body of note"
    },
    createdAt: {
      type: 'integer',
      "description": "unix timestamp of when note was created",
      "multipleOf" : 1,
      "minimum": 0,
      "maximum": 1.7976931348623157e+308
    },
    updatedAt: {
      type: 'integer',
      "description": "unix timestamp of when note was last updated",
      "multipleOf" : 1,
      "minimum": 0,
      "maximum": 1.7976931348623157e+308
    },
  },
  required: ['guid', 'name', 'createdAt', 'updatedAt'],
  /** Encrypted at rest via RxDB encryption-crypto-js (guid/timestamps stay queryable). */
  encrypted: ['name', 'body'],
};
