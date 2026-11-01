// Generic project-scoped CRUD with whitelisted fields and same-project reference checks.
const { pick } = require('../utils/http');
const { requireProject, assertSameProject, findOr404, nextCode } = require('./referenceService');

/**
 * @param {mongoose.Model} Model
 * @param {object} options
 * @param {string[]} options.fields     editable fields (anything else in the body is ignored)
 * @param {object}   options.refs       { field: [Model, label] } references that must belong to the same project
 * @param {object}   options.code       { field, prefix } auto-generated human readable id
 * @param {object}   options.sort       list sort order
 * @param {Array}    options.populate   populate specs for responses
 * @param {Function} options.validate   async (doc, project) => void, extra business rules before save
 * @param {Function} options.afterSave  async (doc) => void
 */
function createCrudService(Model, options) {
  const { fields, refs = {}, code, sort = { createdAt: 1 }, populate = [], validate, afterSave, label = Model.modelName } = options;

  const withPopulate = (query) => populate.reduce((q, p) => q.populate(p), query);

  async function checkRefs(data, projectId) {
    for (const [field, [RefModel, refLabel]] of Object.entries(refs)) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        if (data[field] === '') data[field] = null;
        await assertSameProject(RefModel, data[field], projectId, refLabel);
      }
    }
  }

  async function getById(id) {
    await findOr404(Model, id, label);
    return withPopulate(Model.findById(id));
  }

  return {
    async list(projectId, filter = {}) {
      await requireProject(projectId);
      return withPopulate(Model.find({ ...filter, project: projectId }).sort(sort));
    },

    getById,

    async create(body) {
      const project = await requireProject(body.project);
      const data = pick(body, fields);
      await checkRefs(data, project._id);
      const doc = new Model({ ...data, project: project._id });
      if (code && !doc[code.field]) doc[code.field] = await nextCode(Model, code.field, code.prefix, project._id);
      if (validate) await validate(doc, project);
      await doc.save();
      if (afterSave) await afterSave(doc);
      return getById(doc._id);
    },

    async update(id, body) {
      const doc = await findOr404(Model, id, label);
      const data = pick(body, fields);
      await checkRefs(data, doc.project);
      doc.set(data);
      if (validate) await validate(doc, await requireProject(doc.project));
      await doc.save();
      if (afterSave) await afterSave(doc);
      return getById(doc._id);
    },

    async remove(id) {
      const doc = await findOr404(Model, id, label);
      await doc.deleteOne();
      if (afterSave) await afterSave(doc);
      return { _id: doc._id };
    },
  };
}

module.exports = { createCrudService };
