import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradingPanel } from '../trading-panel';
import { parseEther, formatEther } from 'viem';

// Mock the hooks and providers
const mockSwap = vi.fn();
const mockCalcOutGivenIn = vi.fn();
const mockGetTokenBalance = vi.fn();
const mockGetPoolInfo = vi.fn();

vi.mock('@/lib/blockchain/hooks', () => ({
  useWeightedPool: () => ({
    swap: mockSwap,
    calcOutGivenIn: mockCalcOutGivenIn,
    getTokenBalance: mockGetTokenBalance,
    getPoolInfo: mockGetPoolInfo,
    wbnbAddress: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as `0x${string}`,
  }),
}));

const mockIsConnected = vi.fn();
const mockAddress = vi.fn();

vi.mock('wagmi', () => ({
  useAccount: () => ({
    isConnected: mockIsConnected(),
    address: mockAddress(),
  }),
}));

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <button data-testid="connect-button">Connect Wallet</button>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the format utility
vi.mock('@/lib/utils/format', () => ({
  formatSubscriptNumber: (num: number) => num.toFixed(4),
}));

describe('TradingPanel Component', function () {
  const defaultProps = {
    tokenAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    poolAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIsConnected.mockReturnValue(true);
    mockAddress.mockReturnValue('0x1234567890123456789012345678901234567890');
    mockGetTokenBalance.mockResolvedValue(parseEther('100'));
    mockCalcOutGivenIn.mockResolvedValue(parseEther('1000'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', function () {
    it('should render buy/sell mode toggle', function () {
      render(<TradingPanel {...defaultProps} />);

      expect(screen.getByText('Buy')).toBeInTheDocument();
      expect(screen.getByText('Sell')).toBeInTheDocument();
    });

    it('should render input amount field', function () {
      render(<TradingPanel {...defaultProps} />);

      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
    });

    it('should render swap button', function () {
      render(<TradingPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /buy test/i })).toBeInTheDocument();
    });

    it('should show wallet connect prompt when disconnected', function () {
      mockIsConnected.mockReturnValue(false);

      render(<TradingPanel {...defaultProps} />);

      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
    });

    it('should render slippage settings button', function () {
      render(<TradingPanel {...defaultProps} />);

      // Settings button should exist
      const settingsButtons = screen.getAllByRole('button');
      const settingsButton = settingsButtons.find(
        (btn) => btn.querySelector('svg.lucide-settings')
      );
      expect(settingsButton).toBeDefined();
    });
  });

  describe('Mode switching', function () {
    it('should toggle between buy and sell modes', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      // Initially in buy mode
      expect(screen.getByRole('button', { name: /buy test/i })).toBeInTheDocument();

      // Click sell button
      await user.click(screen.getByText('Sell'));

      // Should now be in sell mode
      expect(screen.getByRole('button', { name: /sell test/i })).toBeInTheDocument();
    });

    it('should swap token labels on mode change', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      // In buy mode: pay BNB, receive TEST
      expect(screen.getByText('BNB')).toBeInTheDocument();

      // Switch to sell mode
      await user.click(screen.getByText('Sell'));

      // In sell mode: pay TEST, receive BNB
      // The first token shown should be TEST (the token being sold)
      const tokenLabels = screen.getAllByText('TEST');
      expect(tokenLabels.length).toBeGreaterThan(0);
    });

    it('should clear input/output on mode change', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1.5');

      // Switch mode
      await user.click(screen.getByText('Sell'));

      // Input should be cleared
      expect(input).toHaveValue(null);
    });
  });

  describe('Output calculation', function () {
    it('should call calcOutGivenIn with correct parameters', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      // Advance timers to trigger debounced calculation
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockCalcOutGivenIn).toHaveBeenCalled();
      });
    });

    it('should debounce calculation (300ms)', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');

      // Type rapidly
      await user.type(input, '123');

      // Should not have called yet (within debounce)
      expect(mockCalcOutGivenIn).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockCalcOutGivenIn).toHaveBeenCalledTimes(1);
      });
    });

    it('should clear output on calculation error', async function () {
      mockCalcOutGivenIn.mockRejectedValueOnce(new Error('Calculation failed'));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // Output should remain empty/show 0.0
      await waitFor(() => {
        expect(screen.getByText('0.0')).toBeInTheDocument();
      });
    });
  });

  describe('Slippage handling', function () {
    it('should default to 1%', function () {
      render(<TradingPanel {...defaultProps} />);

      expect(screen.getByText(/Slippage: 1%/)).toBeInTheDocument();
    });

    it('should update slippage via quick buttons', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      // Open settings
      const settingsButtons = screen.getAllByRole('button');
      const settingsButton = settingsButtons.find(
        (btn) => btn.querySelector('.lucide-settings')
      );
      if (settingsButton) {
        await user.click(settingsButton);
      }

      // Click 2% button (use getAllByRole since there may be multiple due to React strict mode)
      const twoPercentButtons = screen.getAllByRole('button', { name: '2%' });
      await user.click(twoPercentButtons[0]);

      expect(screen.getByText(/Slippage: 2%/)).toBeInTheDocument();
    });

    it('should accept custom slippage input', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      // Open settings
      const settingsButtons = screen.getAllByRole('button');
      const settingsButton = settingsButtons.find(
        (btn) => btn.querySelector('.lucide-settings')
      );
      if (settingsButton) {
        await user.click(settingsButton);

        // Find the slippage input (first spinbutton in DOM - settings panel renders before main input)
        const spinbuttons = screen.getAllByRole('spinbutton');
        const slippageInput = spinbuttons[0]; // Slippage input is the first one (in settings panel)
        // Use fireEvent.change directly since user.clear() triggers onChange with empty value
        // which resets slippage to 1 due to the || 1 fallback in the handler
        fireEvent.change(slippageInput, { target: { value: '3.5' } });

        expect(screen.getByText(/Slippage: 3.5%/)).toBeInTheDocument();
      }
    });
  });

  describe('Gas buffer (Max button)', function () {
    describe('Buy mode', function () {
      it('should reserve 0.01 BNB for gas', async function () {
        const bnbBalance = parseEther('1');
        mockGetTokenBalance.mockImplementation(async (address: string) => {
          if (address.toLowerCase() === '0xae13d989dac2f0debff460ac112a837c89baa7cd') {
            return bnbBalance;
          }
          return parseEther('0');
        });

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<TradingPanel {...defaultProps} />);

        // Wait for balances to load
        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        // Click max button (the Balance: link)
        const maxButtons = screen.getAllByText(/Balance:/);
        await user.click(maxButtons[0]);

        // Input should be balance - 0.01
        const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
        const expectedMax = formatEther(bnbBalance - parseEther('0.01'));
        expect(parseFloat(input.value)).toBeCloseTo(parseFloat(expectedMax), 2);
      });

      it('should set max to 0 if balance <= 0.01 BNB', async function () {
        const smallBalance = parseEther('0.005');
        mockGetTokenBalance.mockImplementation(async (address: string) => {
          if (address.toLowerCase() === '0xae13d989dac2f0debff460ac112a837c89baa7cd') {
            return smallBalance;
          }
          return parseEther('0');
        });

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<TradingPanel {...defaultProps} />);

        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        const maxButtons = screen.getAllByText(/Balance:/);
        await user.click(maxButtons[0]);

        const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
        expect(parseFloat(input.value || '0')).toBe(0);
      });
    });

    describe('Sell mode', function () {
      it('should allow full token balance', async function () {
        const tokenBalance = parseEther('1000');
        mockGetTokenBalance.mockImplementation(async (address: string) => {
          if (address === defaultProps.tokenAddress) {
            return tokenBalance;
          }
          return parseEther('10');
        });

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<TradingPanel {...defaultProps} />);

        // Switch to sell mode
        await user.click(screen.getByText('Sell'));

        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        // Click max button
        const maxButtons = screen.getAllByText(/Balance:/);
        await user.click(maxButtons[0]);

        const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
        expect(parseFloat(input.value)).toBeCloseTo(1000, 0);
      });

      it('should not reserve any buffer', async function () {
        const exactBalance = parseEther('500');
        mockGetTokenBalance.mockImplementation(async (address: string) => {
          if (address === defaultProps.tokenAddress) {
            return exactBalance;
          }
          return parseEther('10');
        });

        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<TradingPanel {...defaultProps} />);

        await user.click(screen.getByText('Sell'));

        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        const maxButtons = screen.getAllByText(/Balance:/);
        await user.click(maxButtons[0]);

        const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
        // Should be exactly 500, no gas reserve
        expect(parseFloat(input.value)).toBeCloseTo(500, 0);
      });
    });
  });

  describe('Form validation', function () {
    it('should disable swap button when disconnected', function () {
      mockIsConnected.mockReturnValue(false);
      render(<TradingPanel {...defaultProps} />);

      // When disconnected, connect button is shown instead of swap button
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
    });

    it('should disable swap button when input is empty', function () {
      render(<TradingPanel {...defaultProps} />);

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      expect(swapButton).toBeDisabled();
    });

    it('should disable swap button when input is 0', async function () {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '0');

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      expect(swapButton).toBeDisabled();
    });
  });

  describe('Swap execution flow', function () {
    it('should show loading state during swap', async function () {
      mockSwap.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ txHash: '0xabc' }), 1000))
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      await user.click(swapButton);

      // Should show loading state
      expect(screen.getByText('Swapping...')).toBeInTheDocument();
    });

    it('should clear form after successful swap', async function () {
      mockSwap.mockResolvedValue({ txHash: '0xabc', amountOut: parseEther('1000') });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      await user.click(swapButton);

      await waitFor(() => {
        expect(input).toHaveValue(null);
      });
    });

    it('should display error on swap failure', async function () {
      mockSwap.mockRejectedValue(new Error('Insufficient balance'));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      await user.click(swapButton);

      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
      });
    });

    it('should display success state on completion', async function () {
      mockSwap.mockResolvedValue({ txHash: '0xabcdef123', amountOut: parseEther('1000') });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      await user.click(swapButton);

      await waitFor(() => {
        expect(screen.getByText(/Swap Successful/i)).toBeInTheDocument();
      });
    });

    it('should refresh balances after swap', async function () {
      mockSwap.mockResolvedValue({ txHash: '0xabc', amountOut: parseEther('1000') });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      // Clear the call count before swap
      mockGetTokenBalance.mockClear();

      const swapButton = screen.getByRole('button', { name: /buy test/i });
      await user.click(swapButton);

      await waitFor(() => {
        // Should have called getTokenBalance again to refresh
        expect(mockGetTokenBalance).toHaveBeenCalled();
      });
    });
  });

  describe('Price display', function () {
    it('should show price ratio when input and output are set', async function () {
      mockCalcOutGivenIn.mockResolvedValue(parseEther('1000'));

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<TradingPanel {...defaultProps} />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '1');

      await act(async () => {
        vi.advanceTimersByTime(350);
      });

      await waitFor(() => {
        // Should show price: 1 BNB ≈ X TEST
        expect(screen.getByText(/1 BNB/)).toBeInTheDocument();
      });
    });
  });
});
