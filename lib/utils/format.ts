/**
 * Utility functions for formatting values
 * Phase 5 - Developer Experience improvements
 */

/**
 * Format a number as currency (USD)
 * @param value - Number to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a number with commas
 * @param value - Number to format
 * @returns Formatted number string (e.g., "1,234,567")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Format a percentage value
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "+12.34%", "-5.67%")
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Truncate a wallet address for display
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address (e.g., "0x742d...92f8")
 */
export function formatAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/**
 * Format a large number with K/M/B suffixes
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.2M", "890K", "$4.5B")
 */
export function formatCompactNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`
  }
  return value.toFixed(decimals)
}

/**
 * Format a timestamp to relative time (e.g., "2h ago", "5m ago")
 * @param timestamp - Date timestamp or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: Date | number): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  }
  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`
  }
  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`
  }
  if (diffInSeconds < 604800) {
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }
  return date.toLocaleDateString()
}

/**
 * Format a token price with appropriate decimal places
 * @param price - Token price
 * @returns Formatted price string
 */
export function formatTokenPrice(price: number): string {
  if (price >= 1) {
    return formatCurrency(price)
  }
  // For small values, show more decimal places
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`
  }
  return `$${price.toFixed(6)}`
}

/**
 * Unicode subscript digits for formatting
 */
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']

/**
 * Convert a number to subscript notation
 * @param num - Number to convert to subscript
 * @returns Subscript string representation
 */
function toSubscript(num: number): string {
  return num
    .toString()
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[parseInt(digit)])
    .join('')
}

/**
 * Format a very small number using subscript notation for leading zeros
 * Examples:
 *   0.0000004049 → 0.0₆4049
 *   0.00000000123 → 0.0₈123
 *   0.000000000000045 → 0.0₁₃45
 *
 * @param value - The number to format
 * @param significantDigits - Number of significant digits to show (default: 4)
 * @param threshold - Minimum leading zeros before using subscript notation (default: 4)
 * @returns Formatted string with subscript notation if applicable
 */
export function formatSubscriptNumber(
  value: number,
  significantDigits: number = 4,
  threshold: number = 4
): string {
  // Handle zero and negative numbers
  if (value === 0) return '0'
  if (value < 0) return '-' + formatSubscriptNumber(-value, significantDigits, threshold)

  // For numbers >= 1, use regular formatting
  if (value >= 1) {
    return value.toLocaleString('en-US', { maximumFractionDigits: significantDigits })
  }

  // Convert to string to count leading zeros
  const str = value.toFixed(20) // Use high precision to capture small numbers
  const match = str.match(/^0\.(0*)([1-9]\d*)/)

  if (!match) {
    return value.toString()
  }

  const leadingZeros = match[1].length
  const significantPart = match[2]

  // If not enough leading zeros, use regular decimal notation
  if (leadingZeros < threshold) {
    return value.toFixed(leadingZeros + significantDigits)
  }

  // Use subscript notation: 0.0₆4049
  const truncatedSignificant = significantPart.slice(0, significantDigits)
  return `0.0${toSubscript(leadingZeros)}${truncatedSignificant}`
}

/**
 * Format a token price with subscript notation for very small values
 * @param price - Token price
 * @param currency - Currency symbol to prepend (default: '$')
 * @returns Formatted price string with subscript notation for small values
 */
export function formatTokenPriceSubscript(
  price: number,
  currency: string = '$'
): string {
  if (price >= 1) {
    return `${currency}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (price >= 0.0001) {
    return `${currency}${price.toFixed(6)}`
  }
  // Use subscript notation for very small prices
  return `${currency}${formatSubscriptNumber(price, 4, 4)}`
}

/**
 * Parse a price string and format it with subscript notation if needed
 * Handles formats like "$0.0000004049", "0.0000004049 BNB", "0.0042", etc.
 * @param priceString - The price string to parse and format
 * @returns Formatted price string with subscript notation for small values
 */
export function formatPriceString(priceString: string): string {
  if (!priceString) return priceString

  // Extract the numeric part and any prefix/suffix
  const match = priceString.match(/^(\$)?([0-9.]+)\s*(.*)$/)
  if (!match) return priceString

  const [, prefix = '', numStr, suffix = ''] = match
  const num = parseFloat(numStr)

  if (isNaN(num)) return priceString

  // If number is large enough, return as-is
  if (num >= 0.0001) return priceString

  // Format with subscript notation
  const formatted = formatSubscriptNumber(num)
  return `${prefix}${formatted}${suffix ? ' ' + suffix : ''}`
}
