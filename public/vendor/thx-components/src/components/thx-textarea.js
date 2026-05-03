// @ts-check

/**
 * @fileoverview THX 1138 styled textarea component
 * @module thx-textarea
 */

import { LitElement, html, css } from '../../vendor/lit.js';

let textareaIdCounter = 0;

/**
 * @typedef {Object} TextareaProps
 * @property {string} value - The textarea value
 * @property {string} placeholder - The placeholder text
 * @property {string} label - The textarea label
 * @property {boolean} disabled - Whether the textarea is disabled
 * @property {boolean} readonly - Whether the textarea is readonly
 * @property {boolean} required - Whether the textarea is required
 * @property {string} name - The textarea name
 * @property {number} rows - Number of visible text lines
 * @property {number} cols - Visible width in average character widths
 * @property {number} minlength - Minimum length
 * @property {number} maxlength - Maximum length
 * @property {boolean} autoresize - Whether to auto-resize based on content
 * @property {string} resize - Resize behavior (none, both, horizontal, vertical)
 */

/**
 * THX 1138 styled textarea component
 * @extends {LitElement}
 */
export class ThxTextarea extends LitElement {
  static formAssociated = true;

  static styles = css`
    :host {
      display: block;
    }

    .textarea-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--size-1);
    }

    .label {
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-0);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4);
      color: var(--neutral-600, #666);
    }

    .required-indicator {
      color: var(--accent-error, #d44000);
      margin-left: var(--size-1);
    }

    textarea {
      padding: calc(var(--size-2) + var(--size-1));
      border: none;
      border-bottom: var(--border-size-2) solid var(--neutral-200, #e0e0e0);
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-1);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2);
      background: white;
      color: var(--neutral-800, #333);
      transition:
        border-color var(--duration-moderate-1),
        box-shadow var(--duration-moderate-1);
      width: 100%;
      box-sizing: border-box;
      line-height: var(--font-lineheight-4);
    }

    textarea::placeholder {
      color: var(--neutral-600, #666);
    }

    textarea:focus {
      outline: none;
      border-color: var(--atmos-primary, #a6c8e1);
      box-shadow: 0 0 0 2px rgba(166, 200, 225, 0.3);
    }

    textarea:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: var(--neutral-200, #e0e0e0);
    }

    textarea:read-only {
      background: var(--neutral-200, #e0e0e0);
    }

    /* Resize variants */
    .resize-none {
      resize: none;
    }

    .resize-both {
      resize: both;
    }

    .resize-horizontal {
      resize: horizontal;
    }

    .resize-vertical {
      resize: vertical;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .char-count {
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-0);
      color: var(--neutral-600, #666);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2);
    }

    .char-count.warning {
      color: var(--accent-warning, #d4aa00);
    }

    .char-count.error {
      color: var(--accent-error, #d44000);
    }

    .help-text {
      font-family: var(--font-mono, 'Courier New', Courier, monospace);
      font-size: var(--font-size-0);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2);
      color: var(--neutral-600, #666);
    }

    .help-text.error {
      color: var(--accent-error, #d44000);
    }
  `;

  static properties = {
    value: { type: String },
    placeholder: { type: String },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    required: { type: Boolean },
    name: { type: String },
    rows: { type: Number },
    cols: { type: Number },
    minlength: { type: Number },
    maxlength: { type: Number },
    autoresize: { type: Boolean },
    resize: { type: String },
    errorMessage: { type: String },
    showCharCount: { type: Boolean },
  };

  constructor() {
    super();
    this._internals = this.attachInternals?.();
    this._textareaId = `thx-textarea-${++textareaIdCounter}`;
    this._labelId = `${this._textareaId}-label`;
    this._helpId = `${this._textareaId}-help`;
    this._errorId = `${this._textareaId}-error`;
    /** @type {string} */
    this.value = '';
    this._defaultValue = this.value;
    /** @type {string} */
    this.placeholder = '';
    /** @type {string} */
    this.label = '';
    /** @type {boolean} */
    this.disabled = false;
    /** @type {boolean} */
    this.readonly = false;
    /** @type {boolean} */
    this.required = false;
    /** @type {string} */
    this.name = '';
    /** @type {number} */
    this.rows = 4;
    /** @type {number} */
    this.cols = 20;
    /** @type {number} */
    this.minlength = -1;
    /** @type {number} */
    this.maxlength = -1;
    /** @type {boolean} */
    this.autoresize = false;
    /** @type {string} */
    this.resize = 'vertical';
    /** @type {string} */
    this.errorMessage = '';
    /** @type {boolean} */
    this.showCharCount = false;
  }

  /** @param {Map<string, unknown>} changedProperties */
  updated(changedProperties) {
    if (changedProperties.has('value') || changedProperties.has('disabled')) {
      this._updateFormValue();
    }
  }

  /** @returns {void} */
  firstUpdated() {
    this._defaultValue = this.value;
    this._updateFormValue();
  }

  /** @returns {void} */
  _updateFormValue() {
    this._internals?.setFormValue(this.disabled ? null : this.value);
  }

  /** @returns {void} */
  formResetCallback() {
    this.value = this._defaultValue;
  }

  /** @returns {string|undefined} */
  get describedBy() {
    if (this.errorMessage) return this._errorId;
    return this._helpId;
  }

  /**
   * @returns {HTMLTextAreaElement|null}
   */
  get textareaElement() {
    return /** @type {HTMLTextAreaElement|null} */ (this.renderRoot?.querySelector('textarea'));
  }

  /**
   * @param {InputEvent} event
   * @returns {void}
   */
  handleInput(event) {
    event.stopPropagation();
    const target = /** @type {HTMLTextAreaElement} */ (event.target);
    this.value = target.value;
    this._updateFormValue();

    if (this.autoresize) {
      this.autoResize(target);
    }

    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  handleChange(event) {
    event.stopPropagation();
    const target = /** @type {HTMLTextAreaElement} */ (event.target);
    this.value = target.value;
    this._updateFormValue();
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  /**
   * @param {HTMLTextAreaElement} element
   * @returns {void}
   */
  autoResize(element) {
    element.style.height = 'auto';
    element.style.height = element.scrollHeight + 'px';
  }

  /**
   * @returns {void}
   */
  focus() {
    this.textareaElement?.focus();
  }

  /**
   * @returns {void}
   */
  blur() {
    this.textareaElement?.blur();
  }

  /**
   * @returns {number}
   */
  get charCount() {
    return this.value.length;
  }

  /**
   * @returns {string}
   */
  get charCountClass() {
    if (this.maxlength > 0) {
      const ratio = this.charCount / this.maxlength;
      if (ratio >= 1) return 'error';
      if (ratio >= 0.9) return 'warning';
    }
    return '';
  }

  /**
   * @returns {string}
   */
  get charCountText() {
    if (this.maxlength > 0) {
      return `${this.charCount}/${this.maxlength}`;
    }
    return `${this.charCount}`;
  }

  /**
   * @returns {import('lit').TemplateResult}
   */
  render() {
    return html`
      <div class="textarea-wrapper">
        ${this.label
          ? html`
              <label class="label" id=${this._labelId} for=${this._textareaId}>
                ${this.label}${this.required
                  ? html`<span class="required-indicator">*</span>`
                  : null}
              </label>
            `
          : null}
        <textarea
          id=${this._textareaId}
          .value=${this.value}
          .placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          .name=${this.name}
          .rows=${this.rows}
          .cols=${this.cols}
          minlength=${this.minlength >= 0 ? this.minlength : undefined}
          maxlength=${this.maxlength >= 0 ? this.maxlength : undefined}
          class="resize-${this.resize}"
          aria-describedby=${this.describedBy}
          aria-invalid=${this.errorMessage ? 'true' : 'false'}
          aria-required=${this.required ? 'true' : 'false'}
          @input=${this.handleInput}
          @change=${this.handleChange}
        ></textarea>
        <div class="status-row">
          ${this.errorMessage
            ? html`<span class="help-text error" id=${this._errorId}>${this.errorMessage}</span>`
            : html`<span class="help-text" id=${this._helpId}
                ><slot name="help-text"></slot
              ></span>`}
          ${this.showCharCount
            ? html`<span class="char-count ${this.charCountClass}">${this.charCountText}</span>`
            : null}
        </div>
      </div>
    `;
  }
}

customElements.define('thx-textarea', ThxTextarea);
