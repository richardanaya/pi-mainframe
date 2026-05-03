// @ts-check

/**
 * @fileoverview THX 1138 styled badge component for status indicators.
 * @module thx-badge
 */

import { LitElement, html, css } from '../../vendor/lit.js';

/**
 * @typedef {Object} BadgeConfig
 * @property {string} variant - Badge variant: 'primary' | 'secondary' | 'warning' | 'error' | 'inactive' | 'pulse'
 * @property {boolean} pill - Whether to use pill/circular shape
 * @property {boolean} iconOnly - Whether badge contains only an icon
 */

/**
 * Badge component for status indicators and labels.
 * Styled with THX 1138 monochrome CRT aesthetic.
 *
 * @extends {LitElement}
 */
export class ThxBadge extends LitElement {
  /** @type {import('lit').CSSResult} */
  static styles = css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--size-1) var(--size-2);
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-0);
      font-weight: var(--font-weight-6);
      letter-spacing: var(--font-letterspacing-4);
      text-transform: uppercase;
      border: var(--border-size-1) solid transparent;
      transition: all var(--duration-quick-2);
      line-height: 1;
    }

    .badge--primary {
      background: var(--atmos-primary, #a6c8e1);
      color: var(--neutral-800, #333);
      border-color: var(--atmos-primary, #a6c8e1);
    }

    .badge--secondary {
      background: var(--atmos-secondary, #707e91);
      color: var(--neutral-100, #fafafa);
      border-color: var(--atmos-secondary, #707e91);
    }

    .badge--warning {
      background: var(--accent-warning, #d4aa00);
      color: var(--neutral-800, #333);
      border-color: var(--accent-warning, #d4aa00);
    }

    .badge--error {
      background: var(--accent-error, #d44000);
      color: var(--neutral-100, #fafafa);
      border-color: var(--accent-error, #d44000);
    }

    .badge--inactive {
      background: transparent;
      color: var(--neutral-600, #666);
      border-color: var(--neutral-600, #666);
    }

    .badge--pulse {
      background: var(--atmos-primary, #a6c8e1);
      color: var(--neutral-800, #333);
      border-color: var(--atmos-primary, #a6c8e1);
      animation: pulse 2s infinite;
    }

    .badge--success {
      background: rgba(166, 200, 225, 0.3);
      color: var(--atmos-primary, #a6c8e1);
      border-color: var(--atmos-primary, #a6c8e1);
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .badge--pill {
      border-radius: var(--radius-round);
    }

    .badge--icon-only {
      width: var(--size-5);
      height: var(--size-5);
      padding: 0;
      font-size: var(--font-size-0);
    }

    ::slotted(svg),
    ::slotted(img) {
      width: calc(var(--size-2) + var(--size-1));
      height: calc(var(--size-2) + var(--size-1));
      margin-right: var(--size-1);
    }

    .badge--icon-only ::slotted(svg),
    .badge--icon-only ::slotted(img) {
      margin-right: 0;
    }
  `;

  /**
   * @returns {import('lit').PropertyDeclarations}
   */
  static get properties() {
    return {
      /** Badge variant: 'primary' | 'secondary' | 'warning' | 'error' | 'inactive' | 'pulse' | 'success' */
      variant: { type: String, reflect: true },
      /** Whether to use pill/circular shape */
      pill: { type: Boolean, reflect: true },
      /** Whether badge contains only an icon */
      iconOnly: { type: Boolean, reflect: true, attribute: 'icon-only' },
    };
  }

  constructor() {
    super();
    /** @type {string} */
    this.variant = 'primary';
    /** @type {boolean} */
    this.pill = false;
    /** @type {boolean} */
    this.iconOnly = false;
  }

  /**
   * Render the badge component.
   * @returns {import('lit').TemplateResult}
   */
  render() {
    const classes = {
      badge: true,
      [`badge--${this.variant}`]: true,
      'badge--pill': this.pill,
      'badge--icon-only': this.iconOnly,
    };

    const classString = Object.entries(classes)
      .filter(([_, value]) => value)
      .map(([key]) => key)
      .join(' ');

    return html`<span class="${classString}"><slot></slot></span>`;
  }
}

customElements.define('thx-badge', ThxBadge);
