// React mounting harness. Uses react-reconciler to build the scene tree
// that scene.cjs owns. Exposes `{ root, rerender, unmount, dispatch }`.

'use strict';

const React = require('react');
const Reconciler = require('react-reconciler');
const scene = require('./scene.cjs');

const NO_CONTEXT = {};

function createHostConfig(rootNode) {
  return {
    supportsMutation: true,
    supportsPersistence: false,
    isPrimaryRenderer: true,

    createInstance(type, props) {
      const node = scene.createNode(type, shallowSanitize(props));
      return node;
    },
    createTextInstance(text) {
      return scene.createTextNode(text);
    },
    appendInitialChild(parent, child) { scene.appendChild(parent, child); },
    finalizeInitialChildren() { return false; },
    prepareUpdate() { return true; },
    shouldSetTextContent() { return false; },

    getRootHostContext() { return NO_CONTEXT; },
    getChildHostContext() { return NO_CONTEXT; },
    getPublicInstance(n) { return n; },
    prepareForCommit() { return null; },
    resetAfterCommit() {},
    preparePortalMount() {},

    appendChild(parent, child) { scene.appendChild(parent, child); },
    appendChildToContainer(container, child) { scene.appendChild(container, child); },
    insertBefore(parent, child, beforeChild) { scene.insertBefore(parent, child, beforeChild); },
    insertInContainerBefore(container, child, beforeChild) { scene.insertBefore(container, child, beforeChild); },
    removeChild(parent, child) { scene.removeChild(parent, child); },
    removeChildFromContainer(container, child) { scene.removeChild(container, child); },
    clearContainer(container) {
      while (container.children.length) scene.removeChild(container, container.children[0]);
    },

    commitUpdate(instance, _updatePayload, _type, _oldProps, newProps) {
      scene.updateProps(instance, shallowSanitize(newProps));
    },
    commitTextUpdate(textInstance, _oldText, newText) {
      scene.updateProps(textInstance, { text: String(newText == null ? '' : newText) });
    },
    commitMount() {},
    hideInstance(n) { scene.updateProps(n, Object.assign({}, n.props, { __hidden: true })); },
    unhideInstance(n, props) { scene.updateProps(n, Object.assign({}, props || n.props, { __hidden: false })); },
    hideTextInstance(n) { scene.updateProps(n, Object.assign({}, n.props, { __hidden: true })); },
    unhideTextInstance(n) { scene.updateProps(n, Object.assign({}, n.props, { __hidden: false })); },

    noTimeout: -1,
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    getCurrentEventPriority() { return 16; }, // DefaultEventPriority
    getInstanceFromNode() { return null; },
    beforeActiveInstanceBlur() {},
    afterActiveInstanceBlur() {},
    prepareScopeUpdate() {},
    getInstanceFromScope() { return null; },
    detachDeletedInstance() {},
  };
}

function shallowSanitize(props) {
  // Drop the `children` prop; react-reconciler owns tree structure.
  if (!props) return {};
  const out = {};
  for (const k of Object.keys(props)) {
    if (k === 'children') continue;
    out[k] = props[k];
  }
  return out;
}

function mount(element) {
  const root = scene.createNode('ROOT', {});
  const reconciler = Reconciler(createHostConfig(root));
  const container = reconciler.createContainer(root, 0, null, false, null, '', (e) => { throw e; }, null);
  reconciler.flushSync(() => reconciler.updateContainer(element, container, null, null));
  function rerender(next) {
    reconciler.flushSync(() => reconciler.updateContainer(next, container, null, null));
  }
  function unmount() {
    reconciler.flushSync(() => reconciler.updateContainer(null, container, null, null));
  }
  // Event dispatch — calls the first handler found walking up from node.
  // Wrapped in flushSync so state updates from handlers commit synchronously.
  function dispatch(node, handlerName, payload) {
    let n = node;
    while (n) {
      const fn = n.props && n.props[handlerName];
      if (typeof fn === 'function') {
        reconciler.flushSync(() => fn(payload || {}));
        return true;
      }
      n = n.parent;
    }
    return false;
  }
  return { root, container, reconciler, rerender, unmount, dispatch };
}

module.exports = { mount };
