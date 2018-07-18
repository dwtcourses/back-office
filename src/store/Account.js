import Vue from 'vue'
import _ from 'lodash'
import { grpc } from 'grpc-web-client'
import irohaUtil from '@util/iroha-util'
import notaryUtil from '@util/notary-util'
import { amountToString } from '@util/iroha-amount'
import { getTransferAssetsFrom, getSettlementsFrom } from '@util/store-util'

// TODO: To be removed. This is used for the following reason for now:
//   1. to get asset's properties (e.g. color) which cannot be fetched from API.
const DUMMY_ASSETS = require('@/mocks/wallets.json').wallets

const types = _([
  'SIGNUP',
  'LOGIN',
  'LOGOUT',
  'GET_ACCOUNT_TRANSACTIONS',
  'GET_ACCOUNT_ASSET_TRANSACTIONS',
  'GET_ACCOUNT_ASSETS',
  'GET_ALL_UNSIGNED_TRANSACTIONS',
  'TRANSFER_ASSET',
  'CREATE_SETTLEMENT',
  'ACCEPT_SETTLEMENT',
  'REJECT_SETTLEMENT'
]).chain()
  .flatMap(x => [x + '_REQUEST', x + '_SUCCESS', x + '_FAILURE'])
  .concat(['RESET'])
  .map(x => [x, x])
  .fromPairs()
  .value()

function initialState () {
  return {
    accountId: '',
    nodeIp: irohaUtil.getStoredNodeIp(),
    accountInfo: {},
    rawAssetTransactions: {},
    rawUnsignedTransactions: [],
    rawTransactions: [],
    assets: [],
    connectionError: null
  }
}

const state = initialState()

const getters = {
  wallets (state) {
    return state.assets.map(a => {
      // TODO: it is to get asset's properties (e.g. color) which cannot be fetched from API.
      const DUMMY_ASSET = DUMMY_ASSETS.find(d => {
        return (d.name.toLowerCase() === a.assetId.split('#')[0])
      })

      return {
        id: a.assetId.replace(/#/g, '$'),
        assetId: a.assetId,

        // TODO: get these info from appropreate sources.
        name: DUMMY_ASSET.name,
        asset: DUMMY_ASSET.asset,
        color: DUMMY_ASSET.color,
        address: DUMMY_ASSET.address,

        amount: amountToString(a.balance),
        precision: a.balance.precision
      }
    })
  },

  getTransactionsByAssetId: (state) => (assetId) => {
    return getTransferAssetsFrom(
      state.rawAssetTransactions[assetId],
      state.accountId
    )
  },

  waitingSettlements () {
    return getSettlementsFrom(state.rawUnsignedTransactions)
      .filter(x => x.status === 'waiting')
  },

  // todo: 'you' -> accountId :)

  incomingSettlements () {
    return getters.waitingSettlements().filter(x => x.to === 'you')
  },

  outgoingSettlements () {
    return getters.waitingSettlements().filter(x => x.from === 'you')
  },

  resolvedSettlements (state) {
    return getSettlementsFrom(state.rawTransactions)
      .filter(x => x.status !== 'waiting')
  }
}

/**
 * Store a connection error so the top component can handle it.
 * @param {Object} state
 * @param {Error} err
 */
function handleError (state, err) {
  switch (err.code) {
    case grpc.Code.Unavailable:
    case grpc.Code.Canceled:
      state.connectionError = err
      break

    default:
      state.connectionError = null
  }
}

const mutations = {
  [types.RESET] (state) {
    const s = initialState()

    Object.keys(s).forEach(key => {
      state[key] = s[key]
    })
  },

  [types.SIGNUP_REQUEST] (state) {},

  [types.SIGNUP_SUCCESS] (state, params) {
  },

  [types.SIGNUP_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.LOGIN_REQUEST] (state) {},

  [types.LOGIN_SUCCESS] (state, account) {
    state.accountId = account.accountId
  },

  [types.LOGIN_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.LOGOUT_REQUEST] (state) {},

  [types.LOGOUT_SUCCESS] (state) {},

  [types.LOGOUT_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.GET_ACCOUNT_ASSET_TRANSACTIONS_REQUEST] (state) {},

  [types.GET_ACCOUNT_ASSET_TRANSACTIONS_SUCCESS] (state, { assetId, transactions }) {
    Vue.set(state.rawAssetTransactions, assetId, transactions)
  },

  [types.GET_ACCOUNT_ASSET_TRANSACTIONS_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.GET_ACCOUNT_ASSETS_REQUEST] (state) {},

  [types.GET_ACCOUNT_ASSETS_SUCCESS] (state, assets) {
    state.assets = assets
  },

  [types.GET_ACCOUNT_ASSETS_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.GET_ACCOUNT_TRANSACTIONS_REQUEST] (state) {},

  [types.GET_ACCOUNT_TRANSACTIONS_SUCCESS] (state, transactions) {
    state.rawTransactions = transactions
  },

  [types.GET_ACCOUNT_TRANSACTIONS_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.GET_ALL_UNSIGNED_TRANSACTIONS_REQUEST] (state) {},

  [types.GET_ALL_UNSIGNED_TRANSACTIONS_SUCCESS] (state, transactions) {
    state.rawUnsignedTransactions = transactions
  },

  [types.GET_ALL_UNSIGNED_TRANSACTIONS_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.TRANSFER_ASSET_REQUEST] (state) {},

  [types.TRANSFER_ASSET_SUCCESS] (state) {},

  [types.TRANSFER_ASSET_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.CREATE_SETTLEMENT_REQUEST] (state) {},

  [types.CREATE_SETTLEMENT_SUCCESS] (state) {},

  [types.CREATE_SETTLEMENT_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.ACCEPT_SETTLEMENT_REQUEST] (state) {},

  [types.ACCEPT_SETTLEMENT_SUCCESS] (state) {},

  [types.ACCEPT_SETTLEMENT_FAILURE] (state, err) {
    handleError(state, err)
  },

  [types.REJECT_SETTLEMENT_REQUEST] (state) {},

  [types.REJECT_SETTLEMENT_SUCCESS] (state) {},

  [types.REJECT_SETTLEMENT_FAILURE] (state, err) {
    handleError(state, err)
  }
}

const actions = {
  signup ({ commit }, { username }) {
    commit(types.SIGNUP_REQUEST)

    const { publicKey, privateKey } = irohaUtil.generateKeypair()

    return notaryUtil.signup(username, publicKey)
      .then(() => commit(types.SIGNUP_SUCCESS, { username, publicKey, privateKey }))
      .then(() => ({ username, privateKey }))
      .catch(err => {
        commit(types.SIGNUP_FAILURE, err)
        throw err
      })
  },

  login ({ commit }, { username, privateKey, nodeIp }) {
    commit(types.LOGIN_REQUEST)

    return irohaUtil.login(username, privateKey, nodeIp)
      .then(account => commit(types.LOGIN_SUCCESS, account))
      .catch(err => {
        commit(types.LOGIN_FAILURE, err)
        throw err
      })
  },

  logout ({ commit }) {
    commit(types.LOGOUT_REQUEST)

    return irohaUtil.logout()
      .then(() => {
        commit(types.RESET)
        commit(types.LOGOUT_SUCCESS)
      })
      .catch(err => {
        commit(types.LOGOUT_FAILURE, err)
        throw err
      })
  },

  getAccountAssetTransactions ({ commit, state }, { assetId }) {
    commit(types.GET_ACCOUNT_ASSET_TRANSACTIONS_REQUEST)

    return irohaUtil.getAccountAssetTransactions(state.accountId, assetId)
      .then(responses => {
        commit(types.GET_ACCOUNT_ASSET_TRANSACTIONS_SUCCESS, {
          assetId: assetId,
          transactions: responses
        })
      })
      .catch(err => {
        commit(types.GET_ACCOUNT_ASSET_TRANSACTIONS_FAILURE, err)
        throw err
      })
  },

  getAccountAssets ({ commit, state }) {
    commit(types.GET_ACCOUNT_ASSETS_REQUEST)

    return irohaUtil.getAccountAssets(state.accountId)
      .then(assets => {
        commit(types.GET_ACCOUNT_ASSETS_SUCCESS, assets)
      })
      .catch(err => {
        commit(types.GET_ACCOUNT_ASSETS_FAILURE, err)
        throw err
      })
  },

  getAccountTransactions ({ commit, state }) {
    commit(types.GET_ACCOUNT_TRANSACTIONS_REQUEST)

    return irohaUtil.getAccountTransactions(state.accountId)
      .then(transactions => {
        commit(types.GET_ACCOUNT_TRANSACTIONS_SUCCESS, transactions)
      })
      .catch(err => {
        commit(types.GET_ACCOUNT_TRANSACTIONS_FAILURE, err)
        throw err
      })
  },

  getAllUnsignedTransactions ({ commit, state }) {
    commit(types.GET_ALL_UNSIGNED_TRANSACTIONS_REQUEST)

    return irohaUtil.getAllUnsignedTransactions(state.accountId)
      .then(responses => {
        commit(types.GET_ALL_UNSIGNED_TRANSACTIONS_SUCCESS, responses)
      })
      .catch(err => {
        commit(types.GET_ALL_UNSIGNED_TRANSACTIONS_FAILURE, err)
        throw err
      })
  },

  transferAsset ({ commit, state }, { privateKey, assetId, to, description = '', amount }) {
    commit(types.TRANSFER_ASSET_REQUEST)

    return irohaUtil.transferAsset(privateKey, state.accountId, to, assetId, description, amount)
      .then(() => {
        commit(types.TRANSFER_ASSET_SUCCESS)
      })
      .catch(err => {
        commit(types.TRANSFER_ASSET_FAILURE, err)
        throw err
      })
  },

  createSettlement (
    { commit, state },
    { privateKey, to, offerAssetId, offerAmount, requestAssetId, requestAmount, description = '' }
  ) {
    commit(types.CREATE_SETTLEMENT_REQUEST)

    return irohaUtil.createSettlement(
      privateKey,
      state.accountId,
      to,
      offerAssetId,
      offerAmount,
      requestAssetId,
      requestAmount,
      description
    )
      .then(() => {
        commit(types.CREATE_SETTLEMENT_SUCCESS)
      })
      .catch(err => {
        commit(types.CREATE_SETTLEMENT_FAILURE, err)
        throw err
      })
  },

  acceptSettlement ({ commit, state }, { privateKey, settlementHash }) {
    commit(types.ACCEPT_SETTLEMENT_REQUEST, { privateKey, settlementHash })

    return irohaUtil.acceptSettlement()
      .then(() => {
        commit(types.ACCEPT_SETTLEMENT_SUCCESS)
      })
      .catch(err => {
        commit(types.ACCEPT_SETTLEMENT_FAILURE, err)
        throw err
      })
  },

  rejectSettlement ({ commit, state }, { privateKey, settlementHash }) {
    commit(types.REJECT_SETTLEMENT_REQUEST, { privateKey, settlementHash })

    return irohaUtil.rejectSettlement()
      .then(() => {
        commit(types.REJECT_SETTLEMENT_SUCCESS)
      })
      .catch(err => {
        commit(types.REJECT_SETTLEMENT_FAILURE, err)
        throw err
      })
  }
}

export default {
  types,
  state,
  getters,
  mutations,
  actions
}