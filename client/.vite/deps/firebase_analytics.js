import { A as areCookiesEnabled, D as Component, E as Logger, F as deepEqual, J as isIndexedDBAvailable, M as calculateBackoffMillis, O as ErrorFactory, U as isBrowserExtension, V as getModularInstance, c as _getProvider, f as _registerComponent, g as getApp, k as FirebaseError, nt as validateIndexedDBOpenable, x as registerVersion } from "./index.esm-C1i3BtqY.js";
import "./index.esm-CnlNjAwX.js";
//#region node_modules/@firebase/analytics/dist/esm/index.esm.js
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Type constant for Firebase Analytics.
*/
var ANALYTICS_TYPE = "analytics";
var GA_FID_KEY = "firebase_id";
var ORIGIN_KEY = "origin";
var FETCH_TIMEOUT_MILLIS = 60 * 1e3;
var DYNAMIC_CONFIG_URL = "https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig";
var GTAG_URL = "https://www.googletagmanager.com/gtag/js";
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var logger = new Logger("@firebase/analytics");
var ERROR_FACTORY = new ErrorFactory("analytics", "Analytics", {
	["already-exists"]: "A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.",
	["already-initialized"]: "initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.",
	["already-initialized-settings"]: "Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.",
	["interop-component-reg-failed"]: "Firebase Analytics Interop Component failed to instantiate: {$reason}",
	["invalid-analytics-context"]: "Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}",
	["indexeddb-unavailable"]: "IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}",
	["fetch-throttle"]: "The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.",
	["config-fetch-failed"]: "Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}",
	["no-api-key"]: "The \"apiKey\" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.",
	["no-app-id"]: "The \"appId\" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.",
	["no-client-id"]: "The \"client_id\" field is empty.",
	["invalid-gtag-resource"]: "Trusted Types detected an invalid gtag resource: {$gtagURL}."
});
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Verifies and creates a TrustedScriptURL.
*/
function createGtagTrustedTypesScriptURL(url) {
	if (!url.startsWith(GTAG_URL)) {
		const err = ERROR_FACTORY.create("invalid-gtag-resource", { gtagURL: url });
		logger.warn(err.message);
		return "";
	}
	return url;
}
/**
* Makeshift polyfill for Promise.allSettled(). Resolves when all promises
* have either resolved or rejected.
*
* @param promises Array of promises to wait for.
*/
function promiseAllSettled(promises) {
	return Promise.all(promises.map((promise) => promise.catch((e) => e)));
}
/**
* Creates a TrustedTypePolicy object that implements the rules passed as policyOptions.
*
* @param policyName A string containing the name of the policy
* @param policyOptions Object containing implementations of instance methods for TrustedTypesPolicy, see {@link https://developer.mozilla.org/en-US/docs/Web/API/TrustedTypePolicy#instance_methods
* | the TrustedTypePolicy reference documentation}.
*/
function createTrustedTypesPolicy(policyName, policyOptions) {
	let trustedTypesPolicy;
	if (window.trustedTypes) trustedTypesPolicy = window.trustedTypes.createPolicy(policyName, policyOptions);
	return trustedTypesPolicy;
}
/**
* Inserts gtag script tag into the page to asynchronously download gtag.
* @param dataLayerName Name of datalayer (most often the default, "_dataLayer").
*/
function insertScriptTag(dataLayerName, measurementId) {
	const trustedTypesPolicy = createTrustedTypesPolicy("firebase-js-sdk-policy", { createScriptURL: createGtagTrustedTypesScriptURL });
	const script = document.createElement("script");
	const gtagScriptURL = `${GTAG_URL}?l=${dataLayerName}&id=${measurementId}`;
	script.src = trustedTypesPolicy ? trustedTypesPolicy?.createScriptURL(gtagScriptURL) : gtagScriptURL;
	script.async = true;
	document.head.appendChild(script);
}
/**
* Get reference to, or create, global datalayer.
* @param dataLayerName Name of datalayer (most often the default, "_dataLayer").
*/
function getOrCreateDataLayer(dataLayerName) {
	let dataLayer = [];
	if (Array.isArray(window[dataLayerName])) dataLayer = window[dataLayerName];
	else window[dataLayerName] = dataLayer;
	return dataLayer;
}
/**
* Wrapped gtag logic when gtag is called with 'config' command.
*
* @param gtagCore Basic gtag function that just appends to dataLayer.
* @param initializationPromisesMap Map of appIds to their initialization promises.
* @param dynamicConfigPromisesList Array of dynamic config fetch promises.
* @param measurementIdToAppId Map of GA measurementIDs to corresponding Firebase appId.
* @param measurementId GA Measurement ID to set config for.
* @param gtagParams Gtag config params to set.
*/
async function gtagOnConfig(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId, measurementId, gtagParams) {
	const correspondingAppId = measurementIdToAppId[measurementId];
	try {
		if (correspondingAppId) await initializationPromisesMap[correspondingAppId];
		else {
			const foundConfig = (await promiseAllSettled(dynamicConfigPromisesList)).find((config) => config.measurementId === measurementId);
			if (foundConfig) await initializationPromisesMap[foundConfig.appId];
		}
	} catch (e) {
		logger.error(e);
	}
	gtagCore("config", measurementId, gtagParams);
}
/**
* Wrapped gtag logic when gtag is called with 'event' command.
*
* @param gtagCore Basic gtag function that just appends to dataLayer.
* @param initializationPromisesMap Map of appIds to their initialization promises.
* @param dynamicConfigPromisesList Array of dynamic config fetch promises.
* @param measurementId GA Measurement ID to log event to.
* @param gtagParams Params to log with this event.
*/
async function gtagOnEvent(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementId, gtagParams) {
	try {
		let initializationPromisesToWaitFor = [];
		if (gtagParams && gtagParams["send_to"]) {
			let gaSendToList = gtagParams["send_to"];
			if (!Array.isArray(gaSendToList)) gaSendToList = [gaSendToList];
			const dynamicConfigResults = await promiseAllSettled(dynamicConfigPromisesList);
			for (const sendToId of gaSendToList) {
				const foundConfig = dynamicConfigResults.find((config) => config.measurementId === sendToId);
				const initializationPromise = foundConfig && initializationPromisesMap[foundConfig.appId];
				if (initializationPromise) initializationPromisesToWaitFor.push(initializationPromise);
				else {
					initializationPromisesToWaitFor = [];
					break;
				}
			}
		}
		if (initializationPromisesToWaitFor.length === 0) initializationPromisesToWaitFor = Object.values(initializationPromisesMap);
		await Promise.all(initializationPromisesToWaitFor);
		gtagCore("event", measurementId, gtagParams || {});
	} catch (e) {
		logger.error(e);
	}
}
/**
* Wraps a standard gtag function with extra code to wait for completion of
* relevant initialization promises before sending requests.
*
* @param gtagCore Basic gtag function that just appends to dataLayer.
* @param initializationPromisesMap Map of appIds to their initialization promises.
* @param dynamicConfigPromisesList Array of dynamic config fetch promises.
* @param measurementIdToAppId Map of GA measurementIDs to corresponding Firebase appId.
*/
function wrapGtag(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId) {
	/**
	* Wrapper around gtag that ensures FID is sent with gtag calls.
	* @param command Gtag command type.
	* @param idOrNameOrParams Measurement ID if command is EVENT/CONFIG, params if command is SET.
	* @param gtagParams Params if event is EVENT/CONFIG.
	*/
	async function gtagWrapper(command, ...args) {
		try {
			if (command === "event") {
				const [measurementId, gtagParams] = args;
				await gtagOnEvent(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementId, gtagParams);
			} else if (command === "config") {
				const [measurementId, gtagParams] = args;
				await gtagOnConfig(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId, measurementId, gtagParams);
			} else if (command === "consent") {
				const [consentAction, gtagParams] = args;
				gtagCore("consent", consentAction, gtagParams);
			} else if (command === "get") {
				const [measurementId, fieldName, callback] = args;
				gtagCore("get", measurementId, fieldName, callback);
			} else if (command === "set") {
				const [customParams] = args;
				gtagCore("set", customParams);
			} else gtagCore(command, ...args);
		} catch (e) {
			logger.error(e);
		}
	}
	return gtagWrapper;
}
/**
* Creates global gtag function or wraps existing one if found.
* This wrapped function attaches Firebase instance ID (FID) to gtag 'config' and
* 'event' calls that belong to the GAID associated with this Firebase instance.
*
* @param initializationPromisesMap Map of appIds to their initialization promises.
* @param dynamicConfigPromisesList Array of dynamic config fetch promises.
* @param measurementIdToAppId Map of GA measurementIDs to corresponding Firebase appId.
* @param dataLayerName Name of global GA datalayer array.
* @param gtagFunctionName Name of global gtag function ("gtag" if not user-specified).
*/
function wrapOrCreateGtag(initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId, dataLayerName, gtagFunctionName) {
	let gtagCore = function(..._args) {
		window[dataLayerName].push(arguments);
	};
	if (window[gtagFunctionName] && typeof window[gtagFunctionName] === "function") gtagCore = window[gtagFunctionName];
	window[gtagFunctionName] = wrapGtag(gtagCore, initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId);
	return {
		gtagCore,
		wrappedGtag: window[gtagFunctionName]
	};
}
/**
* Returns the script tag in the DOM matching both the gtag url pattern
* and the provided data layer name.
*/
function findGtagScriptOnPage(dataLayerName) {
	const scriptTags = window.document.getElementsByTagName("script");
	for (const tag of Object.values(scriptTags)) if (tag.src && tag.src.includes(GTAG_URL) && tag.src.includes(dataLayerName)) return tag;
	return null;
}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Backoff factor for 503 errors, which we want to be conservative about
* to avoid overloading servers. Each retry interval will be
* BASE_INTERVAL_MILLIS * LONG_RETRY_FACTOR ^ retryCount, so the second one
* will be ~30 seconds (with fuzzing).
*/
var LONG_RETRY_FACTOR = 30;
/**
* Base wait interval to multiplied by backoffFactor^backoffCount.
*/
var BASE_INTERVAL_MILLIS = 1e3;
/**
* Stubbable retry data storage class.
*/
var RetryData = class {
	constructor(throttleMetadata = {}, intervalMillis = BASE_INTERVAL_MILLIS) {
		this.throttleMetadata = throttleMetadata;
		this.intervalMillis = intervalMillis;
	}
	getThrottleMetadata(appId) {
		return this.throttleMetadata[appId];
	}
	setThrottleMetadata(appId, metadata) {
		this.throttleMetadata[appId] = metadata;
	}
	deleteThrottleMetadata(appId) {
		delete this.throttleMetadata[appId];
	}
};
var defaultRetryData = new RetryData();
/**
* Set GET request headers.
* @param apiKey App API key.
*/
function getHeaders(apiKey) {
	return new Headers({
		Accept: "application/json",
		"x-goog-api-key": apiKey
	});
}
/**
* Fetches dynamic config from backend.
* @param app Firebase app to fetch config for.
*/
async function fetchDynamicConfig(appFields) {
	const { appId, apiKey } = appFields;
	const request = {
		method: "GET",
		headers: getHeaders(apiKey)
	};
	const appUrl = DYNAMIC_CONFIG_URL.replace("{app-id}", appId);
	const response = await fetch(appUrl, request);
	if (response.status !== 200 && response.status !== 304) {
		let errorMessage = "";
		try {
			const jsonResponse = await response.json();
			if (jsonResponse.error?.message) errorMessage = jsonResponse.error.message;
		} catch (_ignored) {}
		throw ERROR_FACTORY.create("config-fetch-failed", {
			httpStatus: response.status,
			responseMessage: errorMessage
		});
	}
	return response.json();
}
/**
* Fetches dynamic config from backend, retrying if failed.
* @param app Firebase app to fetch config for.
*/
async function fetchDynamicConfigWithRetry(app, retryData = defaultRetryData, timeoutMillis) {
	const { appId, apiKey, measurementId } = app.options;
	if (!appId) throw ERROR_FACTORY.create("no-app-id");
	if (!apiKey) {
		if (measurementId) return {
			measurementId,
			appId
		};
		throw ERROR_FACTORY.create("no-api-key");
	}
	const throttleMetadata = retryData.getThrottleMetadata(appId) || {
		backoffCount: 0,
		throttleEndTimeMillis: Date.now()
	};
	const signal = new AnalyticsAbortSignal();
	setTimeout(async () => {
		signal.abort();
	}, timeoutMillis !== void 0 ? timeoutMillis : FETCH_TIMEOUT_MILLIS);
	return attemptFetchDynamicConfigWithRetry({
		appId,
		apiKey,
		measurementId
	}, throttleMetadata, signal, retryData);
}
/**
* Runs one retry attempt.
* @param appFields Necessary app config fields.
* @param throttleMetadata Ongoing metadata to determine throttling times.
* @param signal Abort signal.
*/
async function attemptFetchDynamicConfigWithRetry(appFields, { throttleEndTimeMillis, backoffCount }, signal, retryData = defaultRetryData) {
	const { appId, measurementId } = appFields;
	try {
		await setAbortableTimeout(signal, throttleEndTimeMillis);
	} catch (e) {
		if (measurementId) {
			logger.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${measurementId} provided in the "measurementId" field in the local Firebase config. [${e?.message}]`);
			return {
				appId,
				measurementId
			};
		}
		throw e;
	}
	try {
		const response = await fetchDynamicConfig(appFields);
		retryData.deleteThrottleMetadata(appId);
		return response;
	} catch (e) {
		const error = e;
		if (!isRetriableError(error)) {
			retryData.deleteThrottleMetadata(appId);
			if (measurementId) {
				logger.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${measurementId} provided in the "measurementId" field in the local Firebase config. [${error?.message}]`);
				return {
					appId,
					measurementId
				};
			} else throw e;
		}
		const backoffMillis = Number(error?.customData?.httpStatus) === 503 ? calculateBackoffMillis(backoffCount, retryData.intervalMillis, LONG_RETRY_FACTOR) : calculateBackoffMillis(backoffCount, retryData.intervalMillis);
		const throttleMetadata = {
			throttleEndTimeMillis: Date.now() + backoffMillis,
			backoffCount: backoffCount + 1
		};
		retryData.setThrottleMetadata(appId, throttleMetadata);
		logger.debug(`Calling attemptFetch again in ${backoffMillis} millis`);
		return attemptFetchDynamicConfigWithRetry(appFields, throttleMetadata, signal, retryData);
	}
}
/**
* Supports waiting on a backoff by:
*
* <ul>
*   <li>Promisifying setTimeout, so we can set a timeout in our Promise chain</li>
*   <li>Listening on a signal bus for abort events, just like the Fetch API</li>
*   <li>Failing in the same way the Fetch API fails, so timing out a live request and a throttled
*       request appear the same.</li>
* </ul>
*
* <p>Visible for testing.
*/
function setAbortableTimeout(signal, throttleEndTimeMillis) {
	return new Promise((resolve, reject) => {
		const backoffMillis = Math.max(throttleEndTimeMillis - Date.now(), 0);
		const timeout = setTimeout(resolve, backoffMillis);
		signal.addEventListener(() => {
			clearTimeout(timeout);
			reject(ERROR_FACTORY.create("fetch-throttle", { throttleEndTimeMillis }));
		});
	});
}
/**
* Returns true if the {@link Error} indicates a fetch request may succeed later.
*/
function isRetriableError(e) {
	if (!(e instanceof FirebaseError) || !e.customData) return false;
	const httpStatus = Number(e.customData["httpStatus"]);
	return httpStatus === 429 || httpStatus === 500 || httpStatus === 503 || httpStatus === 504;
}
/**
* Shims a minimal AbortSignal (copied from Remote Config).
*
* <p>AbortController's AbortSignal conveniently decouples fetch timeout logic from other aspects
* of networking, such as retries. Firebase doesn't use AbortController enough to justify a
* polyfill recommendation, like we do with the Fetch API, but this minimal shim can easily be
* swapped out if/when we do.
*/
var AnalyticsAbortSignal = class {
	constructor() {
		this.listeners = [];
	}
	addEventListener(listener) {
		this.listeners.push(listener);
	}
	abort() {
		this.listeners.forEach((listener) => listener());
	}
};
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Event parameters to set on 'gtag' during initialization.
*/
var defaultEventParametersForInit;
/**
* Logs an analytics event through the Firebase SDK.
*
* @param gtagFunction Wrapped gtag function that waits for fid to be set before sending an event
* @param eventName Google Analytics event name, choose from standard list or use a custom string.
* @param eventParams Analytics event parameters.
*/
async function logEvent$1(gtagFunction, initializationPromise, eventName, eventParams, options) {
	if (options && options.global) {
		gtagFunction("event", eventName, eventParams);
		return;
	} else {
		const measurementId = await initializationPromise;
		gtagFunction("event", eventName, {
			...eventParams,
			"send_to": measurementId
		});
	}
}
/**
* Set screen_name parameter for this Google Analytics ID.
*
* @deprecated Use {@link logEvent} with `eventName` as 'screen_view' and add relevant `eventParams`.
* See {@link https://firebase.google.com/docs/analytics/screenviews | Track Screenviews}.
*
* @param gtagFunction Wrapped gtag function that waits for fid to be set before sending an event
* @param screenName Screen name string to set.
*/
async function setCurrentScreen$1(gtagFunction, initializationPromise, screenName, options) {
	if (options && options.global) {
		gtagFunction("set", { "screen_name": screenName });
		return Promise.resolve();
	} else gtagFunction("config", await initializationPromise, {
		update: true,
		"screen_name": screenName
	});
}
/**
* Set user_id parameter for this Google Analytics ID.
*
* @param gtagFunction Wrapped gtag function that waits for fid to be set before sending an event
* @param id User ID string to set
*/
async function setUserId$1(gtagFunction, initializationPromise, id, options) {
	if (options && options.global) {
		gtagFunction("set", { "user_id": id });
		return Promise.resolve();
	} else gtagFunction("config", await initializationPromise, {
		update: true,
		"user_id": id
	});
}
/**
* Set all other user properties other than user_id and screen_name.
*
* @param gtagFunction Wrapped gtag function that waits for fid to be set before sending an event
* @param properties Map of user properties to set
*/
async function setUserProperties$1(gtagFunction, initializationPromise, properties, options) {
	if (options && options.global) {
		const flatProperties = {};
		for (const key of Object.keys(properties)) flatProperties[`user_properties.${key}`] = properties[key];
		gtagFunction("set", flatProperties);
		return Promise.resolve();
	} else gtagFunction("config", await initializationPromise, {
		update: true,
		"user_properties": properties
	});
}
/**
* Retrieves a unique Google Analytics identifier for the web client.
* See {@link https://developers.google.com/analytics/devguides/collection/ga4/reference/config#client_id | client_id}.
*
* @param gtagFunction Wrapped gtag function that waits for fid to be set before sending an event
*/
async function internalGetGoogleAnalyticsClientId(gtagFunction, initializationPromise) {
	const measurementId = await initializationPromise;
	return new Promise((resolve, reject) => {
		gtagFunction("get", measurementId, "client_id", (clientId) => {
			if (!clientId) reject(ERROR_FACTORY.create("no-client-id"));
			resolve(clientId);
		});
	});
}
/**
* Set whether collection is enabled for this ID.
*
* @param enabled If true, collection is enabled for this ID.
*/
async function setAnalyticsCollectionEnabled$1(initializationPromise, enabled) {
	const measurementId = await initializationPromise;
	window[`ga-disable-${measurementId}`] = !enabled;
}
/**
* Consent parameters to default to during 'gtag' initialization.
*/
var defaultConsentSettingsForInit;
/**
* Sets the variable {@link defaultConsentSettingsForInit} for use in the initialization of
* analytics.
*
* @param consentSettings Maps the applicable end user consent state for gtag.js.
*/
function _setConsentDefaultForInit(consentSettings) {
	defaultConsentSettingsForInit = consentSettings;
}
/**
* Sets the variable `defaultEventParametersForInit` for use in the initialization of
* analytics.
*
* @param customParams Any custom params the user may pass to gtag.js.
*/
function _setDefaultEventParametersForInit(customParams) {
	defaultEventParametersForInit = customParams;
}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function validateIndexedDB() {
	if (!isIndexedDBAvailable()) {
		logger.warn(ERROR_FACTORY.create("indexeddb-unavailable", { errorInfo: "IndexedDB is not available in this environment." }).message);
		return false;
	} else try {
		await validateIndexedDBOpenable();
	} catch (e) {
		logger.warn(ERROR_FACTORY.create("indexeddb-unavailable", { errorInfo: e?.toString() }).message);
		return false;
	}
	return true;
}
/**
* Initialize the analytics instance in gtag.js by calling config command with fid.
*
* NOTE: We combine analytics initialization and setting fid together because we want fid to be
* part of the `page_view` event that's sent during the initialization
* @param app Firebase app
* @param gtagCore The gtag function that's not wrapped.
* @param dynamicConfigPromisesList Array of all dynamic config promises.
* @param measurementIdToAppId Maps measurementID to appID.
* @param installations _FirebaseInstallationsInternal instance.
*
* @returns Measurement ID.
*/
async function _initializeAnalytics(app, dynamicConfigPromisesList, measurementIdToAppId, installations, gtagCore, dataLayerName, options) {
	const dynamicConfigPromise = fetchDynamicConfigWithRetry(app);
	dynamicConfigPromise.then((config) => {
		measurementIdToAppId[config.measurementId] = config.appId;
		if (app.options.measurementId && config.measurementId !== app.options.measurementId) logger.warn(`The measurement ID in the local Firebase config (${app.options.measurementId}) does not match the measurement ID fetched from the server (${config.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`);
	}).catch((e) => logger.error(e));
	dynamicConfigPromisesList.push(dynamicConfigPromise);
	const fidPromise = validateIndexedDB().then((envIsValid) => {
		if (envIsValid) return installations.getId();
		else return;
	});
	const [dynamicConfig, fid] = await Promise.all([dynamicConfigPromise, fidPromise]);
	if (!findGtagScriptOnPage(dataLayerName)) insertScriptTag(dataLayerName, dynamicConfig.measurementId);
	if (defaultConsentSettingsForInit) {
		gtagCore("consent", "default", defaultConsentSettingsForInit);
		_setConsentDefaultForInit(void 0);
	}
	gtagCore("js", /* @__PURE__ */ new Date());
	const configProperties = options?.config ?? {};
	configProperties[ORIGIN_KEY] = "firebase";
	configProperties.update = true;
	if (fid != null) configProperties[GA_FID_KEY] = fid;
	gtagCore("config", dynamicConfig.measurementId, configProperties);
	if (defaultEventParametersForInit) {
		gtagCore("set", defaultEventParametersForInit);
		_setDefaultEventParametersForInit(void 0);
	}
	return dynamicConfig.measurementId;
}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* Analytics Service class.
*/
var AnalyticsService = class {
	constructor(app) {
		this.app = app;
	}
	_delete() {
		delete initializationPromisesMap[this.app.options.appId];
		return Promise.resolve();
	}
};
/**
* Maps appId to full initialization promise. Wrapped gtag calls must wait on
* all or some of these, depending on the call's `send_to` param and the status
* of the dynamic config fetches (see below).
*/
var initializationPromisesMap = {};
/**
* List of dynamic config fetch promises. In certain cases, wrapped gtag calls
* wait on all these to be complete in order to determine if it can selectively
* wait for only certain initialization (FID) promises or if it must wait for all.
*/
var dynamicConfigPromisesList = [];
/**
* Maps fetched measurementIds to appId. Populated when the app's dynamic config
* fetch completes. If already populated, gtag config calls can use this to
* selectively wait for only this app's initialization promise (FID) instead of all
* initialization promises.
*/
var measurementIdToAppId = {};
/**
* Name for window global data layer array used by GA: defaults to 'dataLayer'.
*/
var dataLayerName = "dataLayer";
/**
* Name for window global gtag function used by GA: defaults to 'gtag'.
*/
var gtagName = "gtag";
/**
* Reproduction of standard gtag function or reference to existing
* gtag function on window object.
*/
var gtagCoreFunction;
/**
* Wrapper around gtag function that ensures FID is sent with all
* relevant event and config calls.
*/
var wrappedGtagFunction;
/**
* Flag to ensure page initialization steps (creation or wrapping of
* dataLayer and gtag script) are only run once per page load.
*/
var globalInitDone = false;
/**
* Configures Firebase Analytics to use custom `gtag` or `dataLayer` names.
* Intended to be used if `gtag.js` script has been installed on
* this page independently of Firebase Analytics, and is using non-default
* names for either the `gtag` function or for `dataLayer`.
* Must be called before calling `getAnalytics()` or it won't
* have any effect.
*
* @public
*
* @param options - Custom gtag and dataLayer names.
*/
function settings(options) {
	if (globalInitDone) throw ERROR_FACTORY.create("already-initialized");
	if (options.dataLayerName) dataLayerName = options.dataLayerName;
	if (options.gtagName) gtagName = options.gtagName;
}
/**
* Returns true if no environment mismatch is found.
* If environment mismatches are found, throws an INVALID_ANALYTICS_CONTEXT
* error that also lists details for each mismatch found.
*/
function warnOnBrowserContextMismatch() {
	const mismatchedEnvMessages = [];
	if (isBrowserExtension()) mismatchedEnvMessages.push("This is a browser extension environment.");
	if (!areCookiesEnabled()) mismatchedEnvMessages.push("Cookies are not available.");
	if (mismatchedEnvMessages.length > 0) {
		const details = mismatchedEnvMessages.map((message, index) => `(${index + 1}) ${message}`).join(" ");
		const err = ERROR_FACTORY.create("invalid-analytics-context", { errorInfo: details });
		logger.warn(err.message);
	}
}
/**
* Analytics instance factory.
* @internal
*/
function factory(app, installations, options) {
	warnOnBrowserContextMismatch();
	const appId = app.options.appId;
	if (!appId) throw ERROR_FACTORY.create("no-app-id");
	if (!app.options.apiKey) if (app.options.measurementId) logger.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${app.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);
	else throw ERROR_FACTORY.create("no-api-key");
	if (initializationPromisesMap[appId] != null) throw ERROR_FACTORY.create("already-exists", { id: appId });
	if (!globalInitDone) {
		getOrCreateDataLayer(dataLayerName);
		const { wrappedGtag, gtagCore } = wrapOrCreateGtag(initializationPromisesMap, dynamicConfigPromisesList, measurementIdToAppId, dataLayerName, gtagName);
		wrappedGtagFunction = wrappedGtag;
		gtagCoreFunction = gtagCore;
		globalInitDone = true;
	}
	initializationPromisesMap[appId] = _initializeAnalytics(app, dynamicConfigPromisesList, measurementIdToAppId, installations, gtagCoreFunction, dataLayerName, options);
	return new AnalyticsService(app);
}
/**
* Returns an {@link Analytics} instance for the given app.
*
* @public
*
* @param app - The {@link @firebase/app#FirebaseApp} to use.
*/
function getAnalytics(app = getApp()) {
	app = getModularInstance(app);
	const analyticsProvider = _getProvider(app, ANALYTICS_TYPE);
	if (analyticsProvider.isInitialized()) return analyticsProvider.getImmediate();
	return initializeAnalytics(app);
}
/**
* Returns an {@link Analytics} instance for the given app.
*
* @public
*
* @param app - The {@link @firebase/app#FirebaseApp} to use.
*/
function initializeAnalytics(app, options = {}) {
	const analyticsProvider = _getProvider(app, ANALYTICS_TYPE);
	if (analyticsProvider.isInitialized()) {
		const existingInstance = analyticsProvider.getImmediate();
		if (deepEqual(options, analyticsProvider.getOptions())) return existingInstance;
		else throw ERROR_FACTORY.create("already-initialized");
	}
	return analyticsProvider.initialize({ options });
}
/**
* This is a public static method provided to users that wraps four different checks:
*
* 1. Check if it's not a browser extension environment.
* 2. Check if cookies are enabled in current browser.
* 3. Check if IndexedDB is supported by the browser environment.
* 4. Check if the current browser context is valid for using `IndexedDB.open()`.
*
* @public
*
*/
async function isSupported() {
	if (isBrowserExtension()) return false;
	if (!areCookiesEnabled()) return false;
	if (!isIndexedDBAvailable()) return false;
	try {
		return await validateIndexedDBOpenable();
	} catch (error) {
		return false;
	}
}
/**
* Use gtag `config` command to set `screen_name`.
*
* @public
*
* @deprecated Use {@link logEvent} with `eventName` as 'screen_view' and add relevant `eventParams`.
* See {@link https://firebase.google.com/docs/analytics/screenviews | Track Screenviews}.
*
* @param analyticsInstance - The {@link Analytics} instance.
* @param screenName - Screen name to set.
*/
function setCurrentScreen(analyticsInstance, screenName, options) {
	analyticsInstance = getModularInstance(analyticsInstance);
	setCurrentScreen$1(wrappedGtagFunction, initializationPromisesMap[analyticsInstance.app.options.appId], screenName, options).catch((e) => logger.error(e));
}
/**
* Retrieves a unique Google Analytics identifier for the web client.
* See {@link https://developers.google.com/analytics/devguides/collection/ga4/reference/config#client_id | client_id}.
*
* @public
*
* @param app - The {@link @firebase/app#FirebaseApp} to use.
*/
async function getGoogleAnalyticsClientId(analyticsInstance) {
	analyticsInstance = getModularInstance(analyticsInstance);
	return internalGetGoogleAnalyticsClientId(wrappedGtagFunction, initializationPromisesMap[analyticsInstance.app.options.appId]);
}
/**
* Use gtag `config` command to set `user_id`.
*
* @public
*
* @param analyticsInstance - The {@link Analytics} instance.
* @param id - User ID to set.
*/
function setUserId(analyticsInstance, id, options) {
	analyticsInstance = getModularInstance(analyticsInstance);
	setUserId$1(wrappedGtagFunction, initializationPromisesMap[analyticsInstance.app.options.appId], id, options).catch((e) => logger.error(e));
}
/**
* Use gtag `config` command to set all params specified.
*
* @public
*/
function setUserProperties(analyticsInstance, properties, options) {
	analyticsInstance = getModularInstance(analyticsInstance);
	setUserProperties$1(wrappedGtagFunction, initializationPromisesMap[analyticsInstance.app.options.appId], properties, options).catch((e) => logger.error(e));
}
/**
* Sets whether Google Analytics collection is enabled for this app on this device.
* Sets global `window['ga-disable-analyticsId'] = true;`
*
* @public
*
* @param analyticsInstance - The {@link Analytics} instance.
* @param enabled - If true, enables collection, if false, disables it.
*/
function setAnalyticsCollectionEnabled(analyticsInstance, enabled) {
	analyticsInstance = getModularInstance(analyticsInstance);
	setAnalyticsCollectionEnabled$1(initializationPromisesMap[analyticsInstance.app.options.appId], enabled).catch((e) => logger.error(e));
}
/**
* Adds data that will be set on every event logged from the SDK, including automatic ones.
* With gtag's "set" command, the values passed persist on the current page and are passed with
* all subsequent events.
* @public
* @param customParams - Any custom params the user may pass to gtag.js.
*/
function setDefaultEventParameters(customParams) {
	if (wrappedGtagFunction) wrappedGtagFunction("set", customParams);
	else _setDefaultEventParametersForInit(customParams);
}
/**
* Sends a Google Analytics event with given `eventParams`. This method
* automatically associates this logged event with this Firebase web
* app instance on this device.
* List of official event parameters can be found in the gtag.js
* reference documentation:
* {@link https://developers.google.com/gtagjs/reference/ga4-events
* | the GA4 reference documentation}.
*
* @public
*/
function logEvent(analyticsInstance, eventName, eventParams, options) {
	analyticsInstance = getModularInstance(analyticsInstance);
	logEvent$1(wrappedGtagFunction, initializationPromisesMap[analyticsInstance.app.options.appId], eventName, eventParams, options).catch((e) => logger.error(e));
}
/**
* Sets the applicable end user consent state for this web app across all gtag references once
* Firebase Analytics is initialized.
*
* Use the {@link ConsentSettings} to specify individual consent type values. By default consent
* types are set to "granted".
* @public
* @param consentSettings - Maps the applicable end user consent state for gtag.js.
*/
function setConsent(consentSettings) {
	if (wrappedGtagFunction) wrappedGtagFunction("consent", "update", consentSettings);
	else _setConsentDefaultForInit(consentSettings);
}
var name = "@firebase/analytics";
var version = "0.10.21";
/**
* The Firebase Analytics Web SDK.
* This SDK does not work in a Node.js environment.
*
* @packageDocumentation
*/
function registerAnalytics() {
	_registerComponent(new Component(ANALYTICS_TYPE, (container, { options: analyticsOptions }) => {
		return factory(container.getProvider("app").getImmediate(), container.getProvider("installations-internal").getImmediate(), analyticsOptions);
	}, "PUBLIC"));
	_registerComponent(new Component("analytics-internal", internalFactory, "PRIVATE"));
	registerVersion(name, version);
	registerVersion(name, version, "esm2020");
	function internalFactory(container) {
		try {
			const analytics = container.getProvider(ANALYTICS_TYPE).getImmediate();
			return {
				logEvent: (eventName, eventParams, options) => logEvent(analytics, eventName, eventParams, options),
				setUserProperties: (properties, options) => setUserProperties(analytics, properties, options)
			};
		} catch (e) {
			throw ERROR_FACTORY.create("interop-component-reg-failed", { reason: e });
		}
	}
}
registerAnalytics();
//#endregion
export { getAnalytics, getGoogleAnalyticsClientId, initializeAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled, setConsent, setCurrentScreen, setDefaultEventParameters, setUserId, setUserProperties, settings };

//# sourceMappingURL=firebase_analytics.js.map