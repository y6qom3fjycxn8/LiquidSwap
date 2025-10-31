import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Documents from '@/pages/Documents';

vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <div data-testid="connect-button" />,
}));

describe('<Documents />', () => {
  beforeEach(() => {
    render(<Documents />);
  });

  it('renders the architecture header', () => {
    expect(screen.getByText(/system architecture/i)).toBeInTheDocument();
  });

  it('shows the deployed contract addresses', () => {
    expect(screen.getByText(/cammpair/i)).toBeInTheDocument();
    expect(screen.getByText(/Liquid USD/i)).toBeInTheDocument();
  });

  it('embeds the demo video iframe', () => {
    const iframe = screen.getByTitle(/LiquidSwap Demo/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src');
  });
});
