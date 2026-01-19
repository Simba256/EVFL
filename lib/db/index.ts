// Database client and utilities
export { prisma, isDatabaseAvailable, useDatabaseEnabled } from './prisma'

// Token operations
export {
  createToken,
  getTokensFromDb,
  getTokenByAddress,
  getTokenBySymbolFromDb,
  updateTokenMetrics,
  getLeaderboardFromDb,
  searchTokens,
  tokenExists,
  getTokenCount,
  getRecentTokens,
  getTokensByCreator,
  updateTokenStatus,
  type CreateTokenInput,
  type UpdateTokenMetricsInput,
} from './tokens'

// Trade operations
export {
  createTrade,
  getTradesForToken,
  getTradesByTokenId,
  getRecentTrades,
  getTradesByTrader,
  getTradeCount,
  tradeExists,
  get24hVolume,
  getTradeStats,
  createTradesBatch,
  type CreateTradeInput,
} from './trades'

// Holder operations
export {
  upsertHolder,
  getHoldersForToken,
  getHoldersByTokenId,
  getHolderCount,
  getHolderBalance,
  removeHolder,
  upsertHoldersBatch,
  recalculatePercentages,
  type UpsertHolderInput,
} from './holders'

// Price history operations
export {
  getPriceHistory,
  getPriceHistoryByAddress,
  getPriceHistoryRange,
  upsertCandle,
  updateCandleWithTrade,
  getLatestPrice,
  deleteOldCandles,
  CANDLE_INTERVALS,
  type CandleInterval,
  type OHLCVCandle,
  type UpsertCandleInput,
} from './price-history'

// Indexer state operations
export {
  getIndexerState,
  getLastIndexedBlock,
  updateIndexerState,
  recordIndexerError,
  getAllIndexerStates,
  getIndexerStatesByType,
  getIndexerStatesWithErrors,
  resetIndexerState,
  deleteIndexerState,
  type ContractType,
  type EventType,
  type IndexerStateInfo,
} from './indexer-state'
