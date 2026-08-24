export {
  CAPABILITY_LABELS,
  CUSTOMER_CAPABILITY_ORDER,
  DEFAULT_MANAGED_NAMESPACE,
  statusLabelFor,
  type CapabilityAvailability,
  type CapabilityView,
  type WebsiteAdapterId,
  type WebsiteCapability,
} from "./capabilities";

export {
  capabilitiesForConnection,
  describeWebsiteConnection,
  type WebsiteConnectionView,
} from "./resolve";

export {
  applyViaWebsiteAdapter,
  listWebsiteAdapters,
  managedPagesContext,
  publishAdapterFor,
  resolvePublishMethod,
  websiteAdapterMeta,
  type WebsiteAdapterMeta,
} from "./adapter";

export {
  detectWebsite,
  FUNCTIONAL_CONNECTORS,
  UNSUPPORTED_CONNECTORS,
  type ConnectorOption,
  type WebsiteDetectResult,
} from "./detect";
