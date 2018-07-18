<template>
  <section>
    <el-table
      :data="settlements"
      ref="table"
      @row-dblclick="(row) => this.$refs.table.toggleRowExpansion(row)"
    >
      <el-table-column type="expand">
        <template slot-scope="scope">
          <p>
            {{ scope.row.from }} want to exchange {{ scope.row.offer_amount + ' ' + scope.row.offer_asset}}
            for {{ scope.row.request_amount + ' ' + scope.row.request_asset}} with {{ scope.row.to }}
          </p>
          <p>Was <el-tag>created</el-tag> at {{ formatDateLong(scope.row.date) }}</p>
          <p>Message: {{ scope.row.message }}</p>
        </template>
      </el-table-column>
      <el-table-column label="Amount" min-width="220">
        <template slot-scope="scope">
          {{
            scope.row.offer_amount.toFixed(4) + ' ' + scope.row.offer_asset
            + ' → ' +
            scope.row.request_amount.toFixed(4) + ' ' + scope.row.request_asset
          }}
        </template>
      </el-table-column>
      <el-table-column label="Counterparty" min-width="150">
        <template slot-scope="scope">
          to {{ scope.row.to }}
        </template>
      </el-table-column>
      <el-table-column label="Date" width="120">
        <template slot-scope="scope">
          {{ formatDate(scope.row.date) }}
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>
<script>
import { mapGetters } from 'vuex'
import dateFormat from '@/components/mixins/dateFormat'

export default {
  mixins: [dateFormat],

  data () {
    return {
    }
  },

  computed: {
    ...mapGetters({
      settlements: 'outgoingSettlements'
    })
  },

  created () {
    this.fetchAllUnsignedTransactions()
  },

  methods: {
    fetchAllUnsignedTransactions () {
      this.$store.dispatch('getAllUnsignedTransactions')
    }
  }
}
</script>