var $ = require('jquery')
var _ = require('underscore')
var Backbone = require('backbone')
var squel = require('squel')

var model = Backbone.Model.extend({
  idAttribute: 'label'
})

var enclose = function (val) {
  return typeof val === 'string' && val != 'true' && val != 'false' ? "'" + val + "'" : val // eslint-disable-line
}

module.exports = Backbone.Collection.extend({
  model: model,
  initialize: function (models, options) {
    // Save config to collection
    options = options || {}
    this.user = options.user || null
    //this.consumer = new soda.Consumer(this.domain)
    this.dataset = options.table || null
    this.sql = options.sql || null
    this.aggregateFunction = options.aggregateFunction || null
    this.aggregateField = options.aggregateField || null
    this.valueField = options.valueField || null
    this.groupBy = options.groupBy || null
    this.triggerField = options.triggerField || options.groupBy // TODO do we ever need groupBy?
    this.baseFilters = options.baseFilters || []
    this.filters = options.filters || {}
    this.apiKey = options.filters || {}
    this.order = options.order || null
    this.limit = options.limit || this.limit
    this.offset = options.offset || this.offset

    this.countModel = new Backbone.Model()
  },

  url: function () {
    console.log('url!');
    var self = this
    var filters = this.baseFilters.concat(this.getFilters())
    var query = squel.select();
    query.from(this.dataset);
    console.log(query.toString)
    // Aggregate & group by
    console.log('45', this);
    if (this.valueField || this.aggregateFunction || this.groupBy) {
      // If valueField specified, use it as the value
      if (this.valueField) {
        query.field(this.valueField + ' as value')
      }
      // Otherwise use the aggregateFunction / aggregateField as the value
      else {
        // If group by was specified but no aggregate function, use count by default
        if (!this.aggregateFunction) this.aggregateFunction = 'count'

        // Aggregation
        console.log('here!');
        console.log(query.toString());
        query.field(this.aggregateFunction + '(' + (this.aggregateField || '*') + ') as value')
        console.log(query.toString());
      }

      // Group by
      if (this.groupBy) {
        query.field(this.groupBy + ' as label')
          .group(this.groupBy)

        // Order by (only if there will be multiple results)
        query.order(this.order || 'value desc')
      }
    } else {
      // Offset
      if (this.offset) query.offset(this.offset)

      // Order by
      query.order(this.order || ':id')
    }

    // Where
    if (filters.length) {
      // Parse filter expressions into basic SQL strings and concatenate
      filters = _.map(filters, function (filter) {
        return self.parseExpression(filter.field, filter.expression)
      }).join(' and ')
      query.where(filters)
    }

    // Full text search
    if (this.search) query.q(this.search)

    // Limit
    query.limit(this.limit || '5000')
    console.log('query',query);
    //return query.getURL()

    var output = 'https://' + self.user +
           '.cartodb.com/api/v2/sql?q=' + query.toString();

    console.log('output',output);

    return output;
  },

  exportUrl: function () {
    // TODO generate CartoDB url which generates CSV
    // probably from this.url()
    return this.url()
  },

  /** TODO can be generic in superclass**/
  setFilter: function (filter) {
    if (filter.expression) {
      this.filters[filter.field] = filter
    } else {
      delete this.filters[filter.field]
    }
  },
  /** TODO can be generic in superclass**/
  getFilters: function (key) {
    var filters = this.filters

    if (key) {
      return filters[key]
    } else {
      // If dontFilterSelf enabled, remove the filter this collection's triggerField
      // (don't do this if key provided since that's usually done to see if a filter is set
      // rather than to perform an actual filter query)
      if (!_.isEmpty(filters) && this.dontFilterSelf) {
        filters = _.omit(filters, this.triggerField)
      }

      return _.values(filters)
    }
  },
  /** TODO can be generic in superclass**/
  parseExpression: function (field, expression) {
    if (expression['type'] === 'and' || expression['type'] === 'or') {
      return [
        this.parseExpression(field, expression.value[0]),
        expression.type,
        this.parseExpression(field, expression.value[1])
      ].join(' ')
    } else if (expression['type'] === 'in' || expression['type'] === 'not in') {
      return [
        field,
        expression.type,
        '(' + expression.value.map(enclose).join(', ') + ')'
      ].join(' ')
    } else {
      return [
        field,
        expression.type,
        enclose(expression.value)
      ].join(' ')
    }
  },

  parse: function (response) {
    return response.rows
  },

  getRecordCount: function () {
    // TODO get # of records
    return 0
  }
})
