you will be using svelt 5 with runes, so use this migration guide learn the new sintax 

Version 5 comes with an overhauled syntax and reactivity system. While it may look different at first, you’ll soon notice many similarities. This guide goes over the changes in detail and shows you how to upgrade. Along with it, we also provide information on *why* we did these changes.


Migrating to SvelteKit v2

Upgrading from SvelteKit version 1 to version 2 should be mostly seamless. There are a few breaking changes to note, which are listed here. You can use npx sv migrate sveltekit-2 to migrate some of these changes automatically.

We highly recommend upgrading to the most recent 1.x version before upgrading to 2.0, so that you can take advantage of targeted deprecation warnings. We also recommend updating to Svelte 4 first: Later versions of SvelteKit 1.x support it, and SvelteKit 2.0 requires it.
redirect and error are no longer thrown by you

Previously, you had to throw the values returned from error(...) and redirect(...) yourself. In SvelteKit 2 this is no longer the case — calling the functions is sufficient.

import { error } from '@sveltejs/kit'

// ...
error(500, 'something went wrong');

svelte-migrate will do these changes automatically for you.

If the error or redirect is thrown inside a try {...} block (hint: don’t do this!), you can distinguish them from unexpected errors using isHttpError and isRedirect imported from @sveltejs/kit.
path is required when setting cookies

When receiving a Set-Cookie header that doesn’t specify a path, browsers will set the cookie path to the parent of the resource in question. This behaviour isn’t particularly helpful or intuitive, and frequently results in bugs because the developer expected the cookie to apply to the domain as a whole.

As of SvelteKit 2.0, you need to set a path when calling cookies.set(...), cookies.delete(...) or cookies.serialize(...) so that there’s no ambiguity. Most of the time, you probably want to use path: '/', but you can set it to whatever you like, including relative paths — '' means ‘the current path’, '.' means ‘the current directory’.

/** @type {import('./$types').PageServerLoad} */
export function load({ cookies }) {
	cookies.set(name, value, { path: '/' });
	return { response }
}

svelte-migrate will add comments highlighting the locations that need to be adjusted.
Top-level promises are no longer awaited

In SvelteKit version 1, if the top-level properties of the object returned from a load function were promises, they were automatically awaited. With the introduction of streaming this behavior became a bit awkward as it forces you to nest your streamed data one level deep.

As of version 2, SvelteKit no longer differentiates between top-level and non-top-level promises. To get back the blocking behavior, use await (with Promise.all to prevent waterfalls, where appropriate):

// If you have a single promise
/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {
	const response = await fetch(url).then(r => r.json());
	return { response }
}

// If you have multiple promises
/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch }) {

	const [a, b] = await Promise.all([
	  fetch(url1).then(r => r.json()),
	  fetch(url2).then(r => r.json()),
	]);
	return { a, b };
}

goto(...) changes

goto(...) no longer accepts external URLs. To navigate to an external URL, use window.location.href = url. The state object now determines $page.state and must adhere to the App.PageState interface, if declared. See shallow routing for more details.
paths are now relative by default

In SvelteKit 1, %sveltekit.assets% in your app.html was replaced with a relative path by default (i.e. . or .. or ../.. etc, depending on the path being rendered) during server-side rendering unless the paths.relative config option was explicitly set to false. The same was true for base and assets imported from $app/paths, but only if the paths.relative option was explicitly set to true.

This inconsistency is fixed in version 2. Paths are either always relative or always absolute, depending on the value of paths.relative. It defaults to true as this results in more portable apps: if the base is something other than the app expected (as is the case when viewed on the Internet Archive, for example) or unknown at build time (as is the case when deploying to IPFS and so on), fewer things are likely to break.
Server fetches are not trackable anymore

Previously it was possible to track URLs from fetches on the server in order to rerun load functions. This poses a possible security risk (private URLs leaking), and for this reason it was behind the dangerZone.trackServerFetches setting, which is now removed.
preloadCode arguments must be prefixed with base

SvelteKit exposes two functions, preloadCode and preloadData, for programmatically loading the code and data associated with a particular path. In version 1, there was a subtle inconsistency — the path passed to preloadCode did not need to be prefixed with the base path (if set), while the path passed to preloadData did.

This is fixed in SvelteKit 2 — in both cases, the path should be prefixed with base if it is set.

Additionally, preloadCode now takes a single argument rather than n arguments.
resolvePath has been removed

SvelteKit 1 included a function called resolvePath which allows you to resolve a route ID (like /blog/[slug]) and a set of parameters (like { slug: 'hello' }) to a pathname. Unfortunately the return value didn’t include the base path, limiting its usefulness in cases where base was set.

For this reason, SvelteKit 2 replaces resolvePath with a (slightly better named) function called resolveRoute, which is imported from $app/paths and which takes base into account.


import { resolveRoute } from '$app/paths';

const path = resolveRoute('/blog/[slug]', { slug });

svelte-migrate will do the method replacement for you, though if you later prepend the result with base, you need to remove that yourself.
Improved error handling

Errors are handled inconsistently in SvelteKit 1. Some errors trigger the handleError hook but there is no good way to discern their status (for example, the only way to tell a 404 from a 500 is by seeing if event.route.id is null), while others (such as 405 errors for POST requests to pages without actions) don’t trigger handleError at all, but should. In the latter case, the resulting $page.error will deviate from the App.Error type, if it is specified.

SvelteKit 2 cleans this up by calling handleError hooks with two new properties: status and message. For errors thrown from your code (or library code called by your code) the status will be 500 and the message will be Internal Error. While error.message may contain sensitive information that should not be exposed to users, message is safe.
Dynamic environment variables cannot be used during prerendering

The $env/dynamic/public and $env/dynamic/private modules provide access to run time environment variables, as opposed to the build time environment variables exposed by $env/static/public and $env/static/private.

During prerendering in SvelteKit 1, they are one and the same. This means that prerendered pages that make use of ‘dynamic’ environment variables are really ‘baking in’ build time values, which is incorrect. Worse, $env/dynamic/public is populated in the browser with these stale values if the user happens to land on a prerendered page before navigating to dynamically-rendered pages.

Because of this, dynamic environment variables can no longer be read during prerendering in SvelteKit 2 — you should use the static modules instead. If the user lands on a prerendered page, SvelteKit will request up-to-date values for $env/dynamic/public from the server (by default from a module called /_app/env.js) instead of reading them from the server-rendered HTML.
form and data have been removed from use:enhance callbacks

If you provide a callback to use:enhance, it will be called with an object containing various useful properties.

In SvelteKit 1, those properties included form and data. These were deprecated some time ago in favour of formElement and formData, and have been removed altogether in SvelteKit 2.
Forms containing file inputs must use multipart/form-data

If a form contains an <input type="file"> but does not have an enctype="multipart/form-data" attribute, non-JS submissions will omit the file. SvelteKit 2 will throw an error if it encounters a form like this during a use:enhance submission to ensure that your forms work correctly when JavaScript is not present.
Generated tsconfig.json is more strict

Previously, the generated tsconfig.json was trying its best to still produce a somewhat valid config when your tsconfig.json included paths or baseUrl. In SvelteKit 2, the validation is more strict and will warn when you use either paths or baseUrl in your tsconfig.json. These settings are used to generate path aliases and you should use the alias config option in your svelte.config.js instead, to also create a corresponding alias for the bundler.
getRequest no longer throws errors

The @sveltejs/kit/node module exports helper functions for use in Node environments, including getRequest which turns a Node ClientRequest into a standard Request object.

In SvelteKit 1, getRequest could throw if the Content-Length header exceeded the specified size limit. In SvelteKit 2, the error will not be thrown until later, when the request body (if any) is being read. This enables better diagnostics and simpler code.
vitePreprocess is no longer exported from @sveltejs/kit/vite

Since @sveltejs/vite-plugin-svelte is now a peer dependency, SvelteKit 2 no longer re-exports vitePreprocess. You should import it directly from @sveltejs/vite-plugin-svelte.
Updated dependency requirements

SvelteKit 2 requires Node 18.13 or higher, and the following minimum dependency versions:

    svelte@4
    vite@5
    typescript@5
    @sveltejs/vite-plugin-svelte@3 (this is now required as a peerDependency of SvelteKit — previously it was directly depended upon)
    @sveltejs/adapter-cloudflare@3 (if you’re using these adapters)
    @sveltejs/adapter-cloudflare-workers@2
    @sveltejs/adapter-netlify@3
    @sveltejs/adapter-node@2
    @sveltejs/adapter-static@3
    @sveltejs/adapter-vercel@4

svelte-migrate will update your package.json for you.

As part of the TypeScript upgrade, the generated tsconfig.json (the one your tsconfig.json extends from) now uses "moduleResolution": "bundler" (which is recommended by the TypeScript team, as it properly resolves types from packages with an exports map in package.json) and verbatimModuleSyntax (which replaces the existing importsNotUsedAsValues and preserveValueImports flags — if you have those in your tsconfig.json, remove them. svelte-migrate will do this for you).
SvelteKit 2.12: $app/stores deprecated

SvelteKit 2.12 introduced $app/state based on the Svelte 5 runes API. $app/state provides everything that $app/stores provides but with more flexibility as to where and how you use it. Most importantly, the page object is now fine-grained, e.g. updates to page.state will not invalidate page.data and vice-versa.

As a consequence, $app/stores is deprecated and subject to be removed in SvelteKit 3. We recommend upgrading to Svelte 5, if you haven’t already, and then migrate away from $app/stores. Most of the replacements should be pretty simple: Replace the $app/stores import with $app/state and remove the $ prefixes from the usage sites.

<script>
	import { page } from '$app/state';
</script>

{page.data}

Use npx sv migrate app-state to auto-migrate most of your $app/stores usages inside .svelte components.

You don’t have to migrate to the new syntax right away - Svelte 5 still supports the old Svelte 4 syntax, and you can mix and match components using the new syntax with components using the old and vice versa. We expect many people to be able to upgrade with only a few lines of code changed initially. There’s also a [migration script](#Migration-script) that helps you with many of these steps automatically.

## Reactivity syntax changes

At the heart of Svelte 5 is the new runes API. Runes are basically compiler instructions that inform Svelte about reactivity. Syntactically, runes are functions starting with a dollar-sign.

### let → $state

In Svelte 4, a `let` declaration at the top level of a component was implicitly reactive. In Svelte 5, things are more explicit: a variable is reactive when created using the `$state` rune. Let’s migrate the counter to runes mode by wrapping the counter in `$state`:

```
<script>
	let count = $state(0);
</script>
```

Nothing else changes. `count` is still the number itself, and you read and write directly to it, without a wrapper like `.value` or `getCount()`.

> Why we did this
>
> `let` being implicitly reactive at the top level worked great, but it meant that reactivity was constrained - a `let` declaration anywhere else was not reactive. This forced you to resort to using stores when refactoring code out of the top level of components for reuse. This meant you had to learn an entirely separate reactivity model, and the result often wasn’t as nice to work with. Because reactivity is more explicit in Svelte 5, you can keep using the same API outside the top level of components. Head to [the tutorial](/tutorial) to learn more.

### $: → $derived/$effect

In Svelte 4, a `$:` statement at the top level of a component could be used to declare a derivation, i.e. state that is entirely defined through a computation of other state. In Svelte 5, this is achieved using the `$derived` rune:

```
<script>
	let count = $state(0);
	$: const double = $derived(count * 2);
</script>
```

As with `$state`, nothing else changes. `double` is still the number itself, and you read it directly, without a wrapper like `.value` or `getDouble()`.

A `$:` statement could also be used to create side effects. In Svelte 5, this is achieved using the `$effect` rune:

```
<script>
	let count = $state(0);

	$:$effect(() => {
		if (count > 5) {
			alert('Count is too high!');
		}
	});
</script>
```

Note that [when `$effect` runs is different](%24effect#Understanding-dependencies) than when `$:` runs.

> Why we did this
>
> `$:` was a great shorthand and easy to get started with: you could slap a `$:` in front of most code and it would somehow work. This intuitiveness was also its drawback the more complicated your code became, because it wasn’t as easy to reason about. Was the intent of the code to create a derivation, or a side effect? With `$derived` and `$effect`, you have a bit more up-front decision making to do (spoiler alert: 90% of the time you want `$derived`), but future-you and other developers on your team will have an easier time.
>
> There were also gotchas that were hard to spot:
>
> * `$:` only updated directly before rendering, which meant you could read stale values in-between rerenders
> * `$:` only ran once per tick, which meant that statements may run less often than you think
> * `$:` dependencies were determined through static analysis of the dependencies. This worked in most cases, but could break in subtle ways during a refactoring where dependencies would be for example moved into a function and no longer be visible as a result
> * `$:` statements were also ordered by using static analysis of the dependencies. In some cases there could be ties and the ordering would be wrong as a result, needing manual interventions. Ordering could also break while refactoring code and some dependencies no longer being visible as a result.
>
> Lastly, it wasn’t TypeScript-friendly (our editor tooling had to jump through some hoops to make it valid for TypeScript), which was a blocker for making Svelte’s reactivity model truly universal.
>
> `$derived` and `$effect` fix all of these by
>
> * always returning the latest value
> * running as often as needed to be stable
> * determining the dependencies at runtime, and therefore being immune to refactorings
> * executing dependencies as needed and therefore being immune to ordering problems
> * being TypeScript-friendly

### export let → $props

In Svelte 4, properties of a component were declared using `export let`. Each property was one declaration. In Svelte 5, all properties are declared through the `$props` rune, through destructuring:

```
<script>
	export let optional = 'unset';
	export let required;
	let { optional = 'unset', required } = $props();
</script>
```

There are multiple cases where declaring properties becomes less straightforward than having a few `export let` declarations:

* you want to rename the property, for example because the name is a reserved identifier (e.g. `class`)
* you don’t know which other properties to expect in advance
* you want to forward every property to another component

All these cases need special syntax in Svelte 4:

* renaming: `export { klass as class}`
* other properties: `$$restProps`
* all properties `$$props`

In Svelte 5, the `$props` rune makes this straightforward without any additional Svelte-specific syntax:

* renaming: use property renaming `let { class: klass } = $props();`
* other properties: use spreading `let { foo, bar, ...rest } = $props();`
* all properties: don’t destructure `let props = $props();`

```
<script>
	let klass = '';
	export { klass as class};
	let { class: klass, ...rest } = $props();
</script>
<button class={klass} {...$$restPropsrest}>click me</button>
```

> Why we did this
>
> `export let` was one of the more controversial API decisions, and there was a lot of debate about whether you should think about a property being `export`ed or `import`ed. `$props` doesn’t have this trait. It’s also in line with the other runes, and the general thinking reduces to “everything special to reactivity in Svelte is a rune”.
>
> There were also a lot of limitations around `export let`, which required additional API, as shown above. `$props` unite this in one syntactical concept that leans heavily on regular JavaScript destructuring syntax.

## Event changes

Event handlers have been given a facelift in Svelte 5. Whereas in Svelte 4 we use the `on:` directive to attach an event listener to an element, in Svelte 5 they are properties like any other (in other words - remove the colon):

```
<script>
	let count = $state(0);
</script>

<button on:click={() => count++}>
	clicks: {count}
</button>
```

Since they’re just properties, you can use the normal shorthand syntax...

```
<script>
	let count = $state(0);

	function onclick() {
		count++;
	}
</script>

<button {onclick}>
	clicks: {count}
</button>
```

...though when using a named event handler function it’s usually better to use a more descriptive name.

### Component events

In Svelte 4, components could emit events by creating a dispatcher with `createEventDispatcher`.

This function is deprecated in Svelte 5. Instead, components should accept *callback props* - which means you then pass functions as properties to these components:

App[x]

```
<script>
	import Pump from './Pump.svelte';

	let size = $state(15);
	let burst = $state(false);

	function reset() {
		size = 15;
		burst = false;
	}
</script>

<Pump
	on:inflate={(power) => {
		size += power.detail;
		if (size > 75) burst = true;
	}}
	on:deflate={(power) => {
		if (size > 0) size -= power.detail;
	}}
/>

{#if burst}
	<button onclick={reset}>new balloon</button>
	<span class="boom">💥</span>
{:else}
	<span class="balloon" style="scale: {0.01 * size}">
		🎈
	</span>
{/if}
```

```
<script lang="ts">
	import Pump from './Pump.svelte';

	let size = $state(15);
	let burst = $state(false);

	function reset() {
		size = 15;
		burst = false;
	}
</script>

<Pump
	on:inflate={(power) => {
		size += power.detail;
		if (size > 75) burst = true;
	}}
	on:deflate={(power) => {
		if (size > 0) size -= power.detail;
	}}
/>

{#if burst}
	<button onclick={reset}>new balloon</button>
	<span class="boom">💥</span>
{:else}
	<span class="balloon" style="scale: {0.01 * size}">
		🎈
	</span>
{/if}
```

Pump[x]

```
<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let { inflate, deflate } = $props();
	let power = $state(5);
</script>

<button onclick={() => dispatch('inflate', power)inflate(power)}>
	inflate
</button>
<button onclick={() => dispatch('deflate', power)deflate(power)}>
	deflate
</button>
<button onclick={() => power--}>-</button>
Pump power: {power}
<button onclick={() => power++}>+</button>
```

```
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let { inflate, deflate } = $props();
	let power = $state(5);
</script>

<button onclick={() => dispatch('inflate', power)inflate(power)}>
	inflate
</button>
<button onclick={() => dispatch('deflate', power)deflate(power)}>
	deflate
</button>
<button onclick={() => power--}>-</button>
Pump power: {power}
<button onclick={() => power++}>+</button>
```

### Bubbling events

Instead of doing `<button on:click>` to ‘forward’ the event from the element to the component, the component should accept an `onclick` callback prop:

```
<script>
	let { onclick } = $props();
</script>

<button on:click {onclick}>
	click me
</button>
```

Note that this also means you can ‘spread’ event handlers onto the element along with other props instead of tediously forwarding each event separately:

```
<script>
	let props = $props();
</script>

<button {...$$props} on:click on:keydown on:all_the_other_stuff {...props}>
	click me
</button>
```

### Event modifiers

In Svelte 4, you can add event modifiers to handlers:

```
<button on:click|once|preventDefault={handler}>...</button>
```

Modifiers are specific to `on:` and so do not work with modern event handlers. Adding things like `event.preventDefault()` inside the handler itself is preferable, since all the logic lives in one place rather than being split between handler and modifiers.

Since event handlers are just functions, you can create your own wrappers as necessary:

```
<script>
	function once(fn) {
		return function (event) {
			if (fn) fn.call(this, event);
			fn = null;
		};
	}

	function preventDefault(fn) {
		return function (event) {
			event.preventDefault();
			fn.call(this, event);
		};
	}
</script>

<button onclick={once(preventDefault(handler))}>...</button>
```

There are three modifiers — `capture`, `passive` and `nonpassive` — that can’t be expressed as wrapper functions, since they need to be applied when the event handler is bound rather than when it runs.

For `capture`, we add the modifier to the event name:

```
<button onclickcapture={...}>...</button>
```

Changing the [`passive`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#using_passive_listeners) option of an event handler, meanwhile, is not something to be done lightly. If you have a use case for it — and you probably don’t! — then you will need to use an action to apply the event handler yourself.

### Multiple event handlers

In Svelte 4, this is possible:

```
<button on:click={one} on:click={two}>...</button>
```

Duplicate attributes/properties on elements — which now includes event handlers — are not allowed. Instead, do this:

```
<button
	onclick={(e) => {
		one(e);
		two(e);
	}}
>
	...
</button>
```

When spreading props, local event handlers must go *after* the spread, or they risk being overwritten:

```
<button
	{...props}
	onclick={(e) => {
		doStuff(e);
		props.onclick?.(e);
	}}
>
	...
</button>
```

> Why we did this
>
> `createEventDispatcher` was always a bit boilerplate-y:
>
> * import the function
> * call the function to get a dispatch function
> * call said dispatch function with a string and possibly a payload
> * retrieve said payload on the other end through a `.detail` property, because the event itself was always a `CustomEvent`
>
> It was always possible to use component callback props, but because you had to listen to DOM events using `on:`, it made sense to use `createEventDispatcher` for component events due to syntactical consistency. Now that we have event attributes (`onclick`), it’s the other way around: Callback props are now the more sensible thing to do.
>
> The removal of event modifiers is arguably one of the changes that seems like a step back for those who’ve liked the shorthand syntax of event modifiers. Given that they are not used that frequently, we traded a smaller surface area for more explicitness. Modifiers also were inconsistent, because most of them were only useable on DOM elements.
>
> Multiple listeners for the same event are also no longer possible, but it was something of an anti-pattern anyway, since it impedes readability: if there are many attributes, it becomes harder to spot that there are two handlers unless they are right next to each other. It also implies that the two handlers are independent, when in fact something like `event.stopImmediatePropagation()` inside `one` would prevent `two` from being called.
>
> By deprecating `createEventDispatcher` and the `on:` directive in favour of callback props and normal element properties, we:
>
> * reduce Svelte’s learning curve
> * remove boilerplate, particularly around `createEventDispatcher`
> * remove the overhead of creating `CustomEvent` objects for events that may not even have listeners
> * add the ability to spread event handlers
> * add the ability to know which event handlers were provided to a component
> * add the ability to express whether a given event handler is required or optional
> * increase type safety (previously, it was effectively impossible for Svelte to guarantee that a component didn’t emit a particular event)

## Snippets instead of slots

In Svelte 4, content can be passed to components using slots. Svelte 5 replaces them with snippets, which are more powerful and flexible, and so slots are deprecated in Svelte 5.

They continue to work, however, and you can pass snippets to a component that uses slots:

Child

```
<slot />
<hr />
<slot name="foo" message="hello" />
```

Parent[x]

```
<script>
	import Child from './Child.svelte';
</script>

<Child>
	default child content

	{#snippet foo({ message })}
		message from child: {message}
	{/snippet}
</Child>
```

```
<script lang="ts">
	import Child from './Child.svelte';
</script>

<Child>
	default child content

	{#snippet foo({ message })}
		message from child: {message}
	{/snippet}
</Child>
```

(The reverse is not true — you cannot pass slotted content to a component that uses [`{@render ...}`](/docs/svelte/%40render) tags.)

When using custom elements, you should still use `<slot />` like before. In a future version, when Svelte removes its internal version of slots, it will leave those slots as-is, i.e. output a regular DOM tag instead of transforming it.

### Default content

In Svelte 4, the easiest way to pass a piece of UI to the child was using a `<slot />`. In Svelte 5, this is done using the `children` prop instead, which is then shown with `{@render children()}`:

```
<script>
	let { children } = $props();
</script>

<slot />
{@render children?.()}
```

### Multiple content placeholders

If you wanted multiple UI placeholders, you had to use named slots. In Svelte 5, use props instead, name them however you like and `{@render ...}` them:

```
<script>
	let { header, main, footer } = $props();
</script>

<header>
	<slot name="header" />
	{@render header()}
</header>

<main>
	<slot name="main" />
	{@render main()}
</main>

<footer>
	<slot name="footer" />
	{@render footer()}
</footer>
```

### Passing data back up

In Svelte 4, you would pass data to a `<slot />` and then retrieve it with `let:` in the parent component. In Svelte 5, snippets take on that responsibility:

App[x]

```
<script>
	import List from './List.svelte';
</script>

<List items={['one', 'two', 'three']} let:item>
	{#snippet item(text)}
		<span>{text}</span>
	{/snippet}
	<span slot="empty">No items yet</span>
	{#snippet empty()}
		<span>No items yet</span>
	{/snippet}
</List>
```

```
<script lang="ts">
	import List from './List.svelte';
</script>

<List items={['one', 'two', 'three']} let:item>
	{#snippet item(text)}
		<span>{text}</span>
	{/snippet}
	<span slot="empty">No items yet</span>
	{#snippet empty()}
		<span>No items yet</span>
	{/snippet}
</List>
```

List[x]

```
<script>
	let { items, item, empty } = $props();
</script>

{#if items.length}
	<ul>
		{#each items as entry}
			<li>
				<slot item={entry} />
				{@render item(entry)}
			</li>
		{/each}
	</ul>
{:else}
	<slot name="empty" />
	{@render empty?.()}
{/if}
```

```
<script lang="ts">
	let { items, item, empty } = $props();
</script>

{#if items.length}
	<ul>
		{#each items as entry}
			<li>
				<slot item={entry} />
				{@render item(entry)}
			</li>
		{/each}
	</ul>
{:else}
	<slot name="empty" />
	{@render empty?.()}
{/if}
```

> Why we did this
>
> Slots were easy to get started with, but the more advanced the use case became, the more involved and confusing the syntax became:
>
> * the `let:` syntax was confusing to many people as it *creates* a variable whereas all other `:` directives *receive* a variable
> * the scope of a variable declared with `let:` wasn’t clear. In the example above, it may look like you can use the `item` slot prop in the `empty` slot, but that’s not true
> * named slots had to be applied to an element using the `slot` attribute. Sometimes you didn’t want to create an element, so we had to add the `<svelte:fragment>` API
> * named slots could also be applied to a component, which changed the semantics of where `let:` directives are available (even today us maintainers often don’t know which way around it works)
>
> Snippets solve all of these problems by being much more readable and clear. At the same time they’re more powerful as they allow you to define sections of UI that you can render *anywhere*, not just passing them as props to a component.

## Migration script

By now you should have a pretty good understanding of the before/after and how the old syntax relates to the new syntax. It probably also became clear that a lot of these migrations are rather technical and repetitive - something you don’t want to do by hand.

We thought the same, which is why we provide a migration script to do most of the migration automatically. You can upgrade your project by using `npx sv migrate svelte-5`. This will do the following things:

* bump core dependencies in your `package.json`
* migrate to runes (`let` → `$state` etc)
* migrate to event attributes for DOM elements (`on:click` → `onclick`)
* migrate slot creations to render tags (`<slot />` → `{@render children()}`)
* migrate slot usages to snippets (`<div slot="x">...</div>` → `{#snippet x()}<div>...</div>{/snippet}`)
* migrate obvious component creations (`new Component(...)` → `mount(Component, ...)`)

You can also migrate a single component in VS Code through the `Migrate Component to Svelte 5 Syntax` command, or in our Playground through the `Migrate` button.

Not everything can be migrated automatically, and some migrations need manual cleanup afterwards. The following sections describe these in more detail.

### run

You may see that the migration script converts some of your `$:` statements to a `run` function which is imported from `svelte/legacy`. This happens if the migration script couldn’t reliably migrate the statement to a `$derived` and concluded this is a side effect instead. In some cases this may be wrong and it’s best to change this to use a `$derived` instead. In other cases it may be right, but since `$:` statements also ran on the server but `$effect` does not, it isn’t safe to transform it as such. Instead, `run` is used as a stopgap solution. `run` mimics most of the characteristics of `$:`, in that it runs on the server once, and runs as `$effect.pre` on the client (`$effect.pre` runs *before* changes are applied to the DOM; most likely you want to use `$effect` instead).

```
<script>
	import { run } from 'svelte/legacy';
	run(() => {
	$effect(() => {
		// some side effect code
	})
</script>
```

### Event modifiers

Event modifiers are not applicable to event attributes (e.g. you can’t do `onclick|preventDefault={...}`). Therefore, when migrating event directives to event attributes, we need a function-replacement for these modifiers. These are imported from `svelte/legacy`, and should be migrated away from in favor of e.g. just using `event.preventDefault()`.

```
<script>
	import { preventDefault } from 'svelte/legacy';
</script>

<button
	onclick={preventDefault((event) => {
		event.preventDefault();
		// ...
	})}
>
	click me
</button>
```

### Things that are not automigrated

The migration script does not convert `createEventDispatcher`. You need to adjust those parts manually. It doesn’t do it because it’s too risky because it could result in breakage for users of the component, which the migration script cannot find out.

The migration script does not convert `beforeUpdate/afterUpdate`. It doesn’t do it because it’s impossible to determine the actual intent of the code. As a rule of thumb you can often go with a combination of `$effect.pre` (runs at the same time as `beforeUpdate` did) and `tick` (imported from `svelte`, allows you to wait until changes are applied to the DOM and then do some work).

## Components are no longer classes

In Svelte 3 and 4, components are classes. In Svelte 5 they are functions and should be instantiated differently. If you need to manually instantiate components, you should use `mount` or `hydrate` (imported from `svelte`) instead. If you see this error using SvelteKit, try updating to the latest version of SvelteKit first, which adds support for Svelte 5. If you’re using Svelte without SvelteKit, you’ll likely have a `main.js` file (or similar) which you need to adjust:

```
import { function mount<Props extends Record<string, any>, Exports extends Record<string, any>>(component: ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>, options: MountOptions<Props>): Exports

Mounts a component to the given target and returns the exports and potentially the props (if compiled with accessors: true) of the component.

Transitions will play during the initial render unless the intro option is set to false.
```

mount } from 'svelte';
import ```` ```
type App = SvelteComponent<Record<string, any>, any, any>
const App: LegacyComponentType
``` ````App from './App.svelte'

const app = new App({ target: document.getElementById("app") });
const ```` ```
const app: {
``` ````
 $on?(type: string, callback: (e: any) => void): () => void;
 $set?(props: Partial<Record<string, any>>): void;
} & Record<string, any>app = ```` ```
mount<Record<string, any>, {
``` ````
 $on?(type: string, callback: (e: any) => void): () => void;
 $set?(props: Partial<Record<string, any>>): void;
} & Record<...>>(component: ComponentType<...> | Component<...>, options: MountOptions<...>): {
 $on?(type: string, callback: (e: any) => void): () => void;
 $set?(props: Partial<Record<string, any>>): void;
} & Record<...>

Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.

Transitions will play during the initial render unless the `intro` option is set to `false`.

mount(`const App: LegacyComponentType`App, { `target: Document | Element | ShadowRoot`

Target element where the component will be mounted.

# $State
The $state rune allows you to create reactive state, which means that your UI reacts when it changes.


<script>
	let count = $state(0);
</script>

<button onclick={() => count++}>
	clicks: {count}
</button>
Unlike other frameworks you may have encountered, there is no API for interacting with state — count is just a number, rather than an object or a function, and you can update it like you would update any other variable.

Deep state
If $state is used with an array or a simple object, the result is a deeply reactive state proxy. Proxies allow Svelte to run code when you read or write properties, including via methods like array.push(...), triggering granular updates.

State is proxified recursively until Svelte finds something other than an array or simple object (like a class or an object created with Object.create). In a case like this...


let todos = $state([
	{
		done: false,
		text: 'add more todos'
	}
]);
...modifying an individual todo’s property will trigger updates to anything in your UI that depends on that specific property:


todos[0].done = !todos[0].done;
If you push a new object to the array, it will also be proxified:


todos.push({
	done: false,
	text: 'eat lunch'
});
When you update properties of proxies, the original object is not mutated. If you need to use your own proxy handlers in a state proxy, you should wrap the object after wrapping it in $state.

Note that if you destructure a reactive value, the references are not reactive — as in normal JavaScript, they are evaluated at the point of destructuring:


let { done, text } = todos[0];

// this will not affect the value of `done`
todos[0].done = !todos[0].done;
Classes
Class instances are not proxied. Instead, you can use $state in class fields (whether public or private), or as the first assignment to a property immediately inside the constructor:


class Todo {
	done = $state(false);

	constructor(text) {
		this.text = $state(text);
	}

	reset() {
		this.text = '';
		this.done = false;
	}
}
The compiler transforms done and text into get / set methods on the class prototype referencing private fields. This means the properties are not enumerable.

When calling methods in JavaScript, the value of this matters. This won’t work, because this inside the reset method will be the <button> rather than the Todo:


<button onclick={todo.reset}>
	reset
</button>
You can either use an inline function...


<button onclick={() => todo.reset()}>
	reset
</button>
...or use an arrow function in the class definition:


class Todo {
	done = $state(false);

	constructor(text) {
		this.text = $state(text);
	}

	reset = () => {
		this.text = '';
		this.done = false;
	}
}
Built-in classes
Svelte provides reactive implementations of built-in classes like Set, Map, Date and URL that can be imported from svelte/reactivity.

$state.raw
In cases where you don’t want objects and arrays to be deeply reactive you can use $state.raw.

State declared with $state.raw cannot be mutated; it can only be reassigned. In other words, rather than assigning to a property of an object, or using an array method like push, replace the object or array altogether if you’d like to update it:


let person = $state.raw({
	name: 'Heraclitus',
	age: 49
});

// this will have no effect
person.age += 1;

// this will work, because we're creating a new person
person = {
	name: 'Heraclitus',
	age: 50
};
This can improve performance with large arrays and objects that you weren’t planning to mutate anyway, since it avoids the cost of making them reactive. Note that raw state can contain reactive state (for example, a raw array of reactive objects).

As with $state, you can declare class fields using $state.raw.

$state.snapshot
To take a static snapshot of a deeply reactive $state proxy, use $state.snapshot:


<script>
	let counter = $state({ count: 0 });

	function onclick() {
		// Will log `{ count: ... }` rather than `Proxy { ... }`
		console.log($state.snapshot(counter));
	}
</script>
This is handy when you want to pass some state to an external library or API that doesn’t expect a proxy, such as structuredClone.

Passing state into functions
JavaScript is a pass-by-value language — when you call a function, the arguments are the values rather than the variables. In other words:

index

function add(a: number, b: number) {
	return a + b;
}

let a = 1;
let b = 2;
let total = add(a, b);
console.log(total); // 3

a = 3;
b = 4;
console.log(total); // still 3!
If add wanted to have access to the current values of a and b, and to return the current total value, you would need to use functions instead:

index

function add(getA: () => number, getB: () => number) {
	return () => getA() + getB();
}

let a = 1;
let b = 2;
let total = add(() => a, () => b);
console.log(total()); // 3

a = 3;
b = 4;
console.log(total()); // 7
State in Svelte is no different — when you reference something declared with the $state rune...


let a = $state(1);
let b = $state(2);
...you’re accessing its current value.

Note that ‘functions’ is broad — it encompasses properties of proxies and get/set properties...

index

function add(input: { a: number, b: number }) {
	return {
		get value() {
			return input.a + input.b;
		}
	};
}

let input = $state({ a: 1, b: 2 });
let total = add(input);
console.log(total.value); // 3

input.a = 3;
input.b = 4;
console.log(total.value); // 7
...though if you find yourself writing code like that, consider using classes instead.

Passing state across modules
You can declare state in .svelte.js and .svelte.ts files, but you can only export that state if it’s not directly reassigned. In other words you can’t do this:

state.svelte

export let count = $state(0);

export function increment() {
	count += 1;
}
That’s because every reference to count is transformed by the Svelte compiler — the code above is roughly equivalent to this:

state.svelte

export let count = $.state(0);

export function increment() {
	$.set(count, $.get(count) + 1);
}
You can see the code Svelte generates by clicking the ‘JS Output’ tab in the playground.

Since the compiler only operates on one file at a time, if another file imports count Svelte doesn’t know that it needs to wrap each reference in $.get and $.set:


import { count } from './state.svelte.js';

console.log(typeof count); // 'object', not 'number'
This leaves you with two options for sharing state between modules — either don’t reassign it...


// This is allowed — since we're updating
// `counter.count` rather than `counter`,
// Svelte doesn't wrap it in `$.state`
export const counter = $state({
	count: 0
});

export function increment() {
	counter.count += 1;
}
...or don’t directly export it:


let count = $state(0);

export function getCount() {
	return count;
}

export function increment() {
	count += 1;
}


$derived
Derived state is declared with the $derived rune:


<script>
	let count = $state(0);
	let doubled = $derived(count * 2);
</script>

<button onclick={() => count++}>
	{doubled}
</button>

<p>{count} doubled is {doubled}</p>
The expression inside $derived(...) should be free of side-effects. Svelte will disallow state changes (e.g. count++) inside derived expressions.

As with $state, you can mark class fields as $derived.

Code in Svelte components is only executed once at creation. Without the $derived rune, doubled would maintain its original value even when count changes.

$derived.by
Sometimes you need to create complex derivations that don’t fit inside a short expression. In these cases, you can use $derived.by which accepts a function as its argument.


<script>
	let numbers = $state([1, 2, 3]);
	let total = $derived.by(() => {
		let total = 0;
		for (const n of numbers) {
			total += n;
		}
		return total;
	});
</script>

<button onclick={() => numbers.push(numbers.length + 1)}>
	{numbers.join(' + ')} = {total}
</button>
In essence, $derived(expression) is equivalent to $derived.by(() => expression).

Understanding dependencies
Anything read synchronously inside the $derived expression (or $derived.by function body) is considered a dependency of the derived state. When the state changes, the derived will be marked as dirty and recalculated when it is next read.

To exempt a piece of state from being treated as a dependency, use untrack.

Overriding derived values
Derived expressions are recalculated when their dependencies change, but you can temporarily override their values by reassigning them (unless they are declared with const). This can be useful for things like optimistic UI, where a value is derived from the ‘source of truth’ (such as data from your server) but you’d like to show immediate feedback to the user:


<script>
	let { post, like } = $props();

	let likes = $derived(post.likes);

	async function onclick() {
		// increment the `likes` count immediately...
		likes += 1;

		// and tell the server, which will eventually update `post`
		try {
			await like();
		} catch {
			// failed! roll back the change
			likes -= 1;
		}
	}
</script>

<button {onclick}>🧡 {likes}</button>
Prior to Svelte 5.25, deriveds were read-only.

Deriveds and reactivity
Unlike $state, which converts objects and arrays to deeply reactive proxies, $derived values are left as-is. For example, in a case like this...


let items = $state([...]);

let index = $state(0);
let selected = $derived(items[index]);
...you can change (or bind: to) properties of selected and it will affect the underlying items array. If items was not deeply reactive, mutating selected would have no effect.

Destructuring
If you use destructuring with a $derived declaration, the resulting variables will all be reactive — this...


let { a, b, c } = $derived(stuff());
...is roughly equivalent to this:


let _stuff = $derived(stuff());
let a = $derived(_stuff.a);
let b = $derived(_stuff.b);
let c = $derived(_stuff.c);
Update propagation
Svelte uses something called push-pull reactivity — when state is updated, everything that depends on the state (whether directly or indirectly) is immediately notified of the change (the ‘push’), but derived values are not re-evaluated until they are actually read (the ‘pull’).

If the new value of a derived is referentially identical to its previous value, downstream updates will be skipped. In other words, Svelte will only update the text inside the button when large changes, not when count changes, even though large depends on count:


<script>
	let count = $state(0);
	let large = $derived(count > 10);
</script>

<button onclick={() => count++}>
	{large}
</button>

$effect
Effects are functions that run when state updates, and can be used for things like calling third-party libraries, drawing on <canvas> elements, or making network requests. They only run in the browser, not during server-side rendering.

Generally speaking, you should not update state inside effects, as it will make code more convoluted and will often lead to never-ending update cycles. If you find yourself doing so, see when not to use $effect to learn about alternative approaches.

You can create an effect with the $effect rune (demo):


<script>
	let size = $state(50);
	let color = $state('#ff3e00');

	let canvas;

	$effect(() => {
		const context = canvas.getContext('2d');
		context.clearRect(0, 0, canvas.width, canvas.height);

		// this will re-run whenever `color` or `size` change
		context.fillStyle = color;
		context.fillRect(0, 0, size, size);
	});
</script>

<canvas bind:this={canvas} width="100" height="100"></canvas>
When Svelte runs an effect function, it tracks which pieces of state (and derived state) are accessed (unless accessed inside untrack), and re-runs the function when that state later changes.

If you’re having difficulty understanding why your $effect is rerunning or is not running see understanding dependencies. Effects are triggered differently than the $: blocks you may be used to if coming from Svelte 4.

Understanding lifecycle
Your effects run after the component has been mounted to the DOM, and in a microtask after state changes. Re-runs are batched (i.e. changing color and size in the same moment won’t cause two separate runs), and happen after any DOM updates have been applied.

You can use $effect anywhere, not just at the top level of a component, as long as it is called while a parent effect is running.

Svelte uses effects internally to represent logic and expressions in your template — this is how <h1>hello {name}!</h1> updates when name changes.

An effect can return a teardown function which will run immediately before the effect re-runs (demo).


<script>
	let count = $state(0);
	let milliseconds = $state(1000);

	$effect(() => {
		// This will be recreated whenever `milliseconds` changes
		const interval = setInterval(() => {
			count += 1;
		}, milliseconds);

		return () => {
			// if a teardown function is provided, it will run
			// a) immediately before the effect re-runs
			// b) when the component is destroyed
			clearInterval(interval);
		};
	});
</script>

<h1>{count}</h1>

<button onclick={() => (milliseconds *= 2)}>slower</button>
<button onclick={() => (milliseconds /= 2)}>faster</button>
Teardown functions also run when the effect is destroyed, which happens when its parent is destroyed (for example, a component is unmounted) or the parent effect re-runs.

Understanding dependencies
$effect automatically picks up any reactive values ($state, $derived, $props) that are synchronously read inside its function body (including indirectly, via function calls) and registers them as dependencies. When those dependencies change, the $effect schedules a re-run.

If $state and $derived are used directly inside the $effect (for example, during creation of a reactive class), those values will not be treated as dependencies.

Values that are read asynchronously — after an await or inside a setTimeout, for example — will not be tracked. Here, the canvas will be repainted when color changes, but not when size changes (demo):


$effect(() => {
	const context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);

	// this will re-run whenever `color` changes...
	context.fillStyle = color;

	setTimeout(() => {
		// ...but not when `size` changes
		context.fillRect(0, 0, size, size);
	}, 0);
});
An effect only reruns when the object it reads changes, not when a property inside it changes. (If you want to observe changes inside an object at dev time, you can use $inspect.)


<script>
	let state = $state({ value: 0 });
	let derived = $derived({ value: state.value * 2 });

	// this will run once, because `state` is never reassigned (only mutated)
	$effect(() => {
		state;
	});

	// this will run whenever `state.value` changes...
	$effect(() => {
		state.value;
	});

	// ...and so will this, because `derived` is a new object each time
	$effect(() => {
		derived;
	});
</script>

<button onclick={() => (state.value += 1)}>
	{state.value}
</button>

<p>{state.value} doubled is {derived.value}</p>
An effect only depends on the values that it read the last time it ran. This has interesting implications for effects that have conditional code.

For instance, if condition is true in the code snippet below, the code inside the if block will run and color will be evaluated. This means that changes to either condition or color will cause the effect to re-run.

Conversely, if condition is false, color will not be evaluated, and the effect will only re-run again when condition changes.


import confetti from 'canvas-confetti';

let condition = $state(true);
let color = $state('#ff3e00');

$effect(() => {
	if (condition) {
		confetti({ colors: [color] });
	} else {
		confetti();
	}
});
$effect.pre
In rare cases, you may need to run code before the DOM updates. For this we can use the $effect.pre rune:


<script>
	import { tick } from 'svelte';

	let div = $state();
	let messages = $state([]);

	// ...

	$effect.pre(() => {
		if (!div) return; // not yet mounted

		// reference `messages` array length so that this code re-runs whenever it changes
		messages.length;

		// autoscroll when new messages are added
		if (div.offsetHeight + div.scrollTop > div.scrollHeight - 20) {
			tick().then(() => {
				div.scrollTo(0, div.scrollHeight);
			});
		}
	});
</script>

<div bind:this={div}>
	{#each messages as message}
		<p>{message}</p>
	{/each}
</div>
Apart from the timing, $effect.pre works exactly like $effect.

$effect.tracking
The $effect.tracking rune is an advanced feature that tells you whether or not the code is running inside a tracking context, such as an effect or inside your template (demo):


<script>
	console.log('in component setup:', $effect.tracking()); // false

	$effect(() => {
		console.log('in effect:', $effect.tracking()); // true
	});
</script>

<p>in template: {$effect.tracking()}</p> <!-- true -->
It is used to implement abstractions like createSubscriber, which will create listeners to update reactive values but only if those values are being tracked (rather than, for example, read inside an event handler).

$effect.pending
When using await in components, the $effect.pending() rune tells you how many promises are pending in the current boundary, not including child boundaries (demo):


<button onclick={() => a++}>a++</button>
<button onclick={() => b++}>b++</button>

<p>{a} + {b} = {await add(a, b)}</p>

{#if $effect.pending()}
	<p>pending promises: {$effect.pending()}</p>
{/if}
$effect.root
The $effect.root rune is an advanced feature that creates a non-tracked scope that doesn’t auto-cleanup. This is useful for nested effects that you want to manually control. This rune also allows for the creation of effects outside of the component initialisation phase.


const destroy = $effect.root(() => {
	$effect(() => {
		// setup
	});

	return () => {
		// cleanup
	};
});

// later...
destroy();
When not to use $effect
In general, $effect is best considered something of an escape hatch — useful for things like analytics and direct DOM manipulation — rather than a tool you should use frequently. In particular, avoid using it to synchronise state. Instead of this...


<script>
	let count = $state(0);
	let doubled = $state();

	// don't do this!
	$effect(() => {
		doubled = count * 2;
	});
</script>
...do this:


<script>
	let count = $state(0);
	let doubled = $derived(count * 2);
</script>
For things that are more complicated than a simple expression like count * 2, you can also use $derived.by.

If you’re using an effect because you want to be able to reassign the derived value (to build an optimistic UI, for example) note that deriveds can be directly overridden as of Svelte 5.25.

You might be tempted to do something convoluted with effects to link one value to another. The following example shows two inputs for “money spent” and “money left” that are connected to each other. If you update one, the other should update accordingly. Don’t use effects for this (demo):


<script>
	const total = 100;
	let spent = $state(0);
	let left = $state(total);

	$effect(() => {
		left = total - spent;
	});

	$effect(() => {
		spent = total - left;
	});
</script>

<label>
	<input type="range" bind:value={spent} max={total} />
	{spent}/{total} spent
</label>

<label>
	<input type="range" bind:value={left} max={total} />
	{left}/{total} left
</label>
Instead, use oninput callbacks or — better still — function bindings where possible (demo):


<script>
	const total = 100;
	let spent = $state(0);
	let left = $derived(total - spent);

	function updateLeft(left) {
		spent = total - left;
	}
</script>

<label>
	<input type="range" bind:value={spent} max={total} />
	{spent}/{total} spent
</label>

<label>
	<input type="range" bind:value={() => left, updateLeft} max={total} />
	{left}/{total} left
</label>
If you absolutely have to update $state within an effect and run into an infinite loop because you read and write to the same $state, use untrack.


$props
The inputs to a component are referred to as props, which is short for properties. You pass props to components just like you pass attributes to elements:

App

<script lang="ts">
	import MyComponent from './MyComponent.svelte';
</script>

<MyComponent adjective="cool" />
On the other side, inside MyComponent.svelte, we can receive props with the $props rune...

MyComponent

<script lang="ts">
	let props = $props();
</script>

<p>this component is {props.adjective}</p>
...though more commonly, you’ll destructure your props:

MyComponent

<script lang="ts">
	let { adjective } = $props();
</script>

<p>this component is {adjective}</p>
Fallback values
Destructuring allows us to declare fallback values, which are used if the parent component does not set a given prop (or the value is undefined):


let { adjective = 'happy' } = $props();
Fallback values are not turned into reactive state proxies (see Updating props for more info)

Renaming props
We can also use the destructuring assignment to rename props, which is necessary if they’re invalid identifiers, or a JavaScript keyword like super:


let { super: trouper = 'lights are gonna find me' } = $props();
Rest props
Finally, we can use a rest property to get, well, the rest of the props:


let { a, b, c, ...others } = $props();
Updating props
References to a prop inside a component update when the prop itself updates — when count changes in App.svelte, it will also change inside Child.svelte. But the child component is able to temporarily override the prop value, which can be useful for unsaved ephemeral state (demo):

App

<script lang="ts">
	import Child from './Child.svelte';

	let count = $state(0);
</script>

<button onclick={() => (count += 1)}>
	clicks (parent): {count}
</button>

<Child {count} />
Child

<script lang="ts">
	let { count } = $props();
</script>

<button onclick={() => (count += 1)}>
	clicks (child): {count}
</button>
While you can temporarily reassign props, you should not mutate props unless they are bindable.

If the prop is a regular object, the mutation will have no effect (demo):

App

<script lang="ts">
	import Child from './Child.svelte';
</script>

<Child object={{ count: 0 }} />
Child

<script lang="ts">
	let { object } = $props();
</script>

<button onclick={() => {
	// has no effect
	object.count += 1
}}>
	clicks: {object.count}
</button>
If the prop is a reactive state proxy, however, then mutations will have an effect but you will see an ownership_invalid_mutation warning, because the component is mutating state that does not ‘belong’ to it (demo):

App

<script lang="ts">
	import Child from './Child.svelte';

	let object = $state({count: 0});
</script>

<Child {object} />
Child

<script lang="ts">
	let { object } = $props();
</script>

<button onclick={() => {
	// will cause the count below to update,
	// but with a warning. Don't mutate
	// objects you don't own!
	object.count += 1
}}>
	clicks: {object.count}
</button>
The fallback value of a prop not declared with $bindable is left untouched — it is not turned into a reactive state proxy — meaning mutations will not cause updates (demo)

Child

<script lang="ts">
	let { object = { count: 0 } } = $props();
</script>

<button onclick={() => {
	// has no effect if the fallback value is used
	object.count += 1
}}>
	clicks: {object.count}
</button>
In summary: don’t mutate props. Either use callback props to communicate changes, or — if parent and child should share the same object — use the $bindable rune.

Type safety
You can add type safety to your components by annotating your props, as you would with any other variable declaration. In TypeScript that might look like this...


<script lang="ts">
	let { adjective }: { adjective: string } = $props();
</script>
...while in JSDoc you can do this:


<script>
	/** @type {{ adjective: string }} */
	let { adjective } = $props();
</script>
You can, of course, separate the type declaration from the annotation:


<script lang="ts">
	interface Props {
		adjective: string;
	}

	let { adjective }: Props = $props();
</script>
Interfaces for native DOM elements are provided in the svelte/elements module (see Typing wrapper components)

Adding types is recommended, as it ensures that people using your component can easily discover which props they should provide.

$props.id()
This rune, added in version 5.20.0, generates an ID that is unique to the current component instance. When hydrating a server-rendered component, the value will be consistent between server and client.

This is useful for linking elements via attributes like for and aria-labelledby.


<script>
	const uid = $props.id();
</script>

<form>
	<label for="{uid}-firstname">First Name: </label>
	<input id="{uid}-firstname" type="text" />

	<label for="{uid}-lastname">Last Name: </label>
	<input id="{uid}-lastname" type="text" />
</form>


$bindable
Ordinarily, props go one way, from parent to child. This makes it easy to understand how data flows around your app.

In Svelte, component props can be bound, which means that data can also flow up from child to parent. This isn’t something you should do often, but it can simplify your code if used sparingly and carefully.

It also means that a state proxy can be mutated in the child.

Mutation is also possible with normal props, but is strongly discouraged — Svelte will warn you if it detects that a component is mutating state it does not ‘own’.

To mark a prop as bindable, we use the $bindable rune:

FancyInput

<script lang="ts">
	let { value = $bindable(), ...props } = $props();
</script>

<input bind:value={value} {...props} />

<style>
	input {
		font-family: 'Comic Sans MS';
		color: deeppink;
	}
</style>
Now, a component that uses <FancyInput> can add the bind: directive (demo):

App

<script lang="ts">
	import FancyInput from './FancyInput.svelte';

	let message = $state('hello');
</script>

<FancyInput bind:value={message} />
<p>{message}</p>
The parent component doesn’t have to use bind: — it can just pass a normal prop. Some parents don’t want to listen to what their children have to say.

In this case, you can specify a fallback value for when no prop is passed at all:

FancyInput

let { value = $bindable('fallback'), ...props } = $props();

$inspect
$inspect only works during development. In a production build it becomes a noop.

The $inspect rune is roughly equivalent to console.log, with the exception that it will re-run whenever its argument changes. $inspect tracks reactive state deeply, meaning that updating something inside an object or array using fine-grained reactivity will cause it to re-fire (demo):


<script>
	let count = $state(0);
	let message = $state('hello');

	$inspect(count, message); // will console.log when `count` or `message` change
</script>

<button onclick={() => count++}>Increment</button>
<input bind:value={message} />
$inspect(...).with
$inspect returns a property with, which you can invoke with a callback, which will then be invoked instead of console.log. The first argument to the callback is either "init" or "update"; subsequent arguments are the values passed to $inspect (demo):


<script>
	let count = $state(0);

	$inspect(count).with((type, count) => {
		if (type === 'update') {
			debugger; // or `console.trace`, or whatever you want
		}
	});
</script>

<button onclick={() => count++}>Increment</button>
A convenient way to find the origin of some change is to pass console.trace to with:


$inspect(stuff).with(console.trace);
$inspect.trace(...)
This rune, added in 5.14, causes the surrounding function to be traced in development. Any time the function re-runs as part of an effect or a derived, information will be printed to the console about which pieces of reactive state caused the effect to fire.


<script>
	import { doSomeWork } from './elsewhere';

	$effect(() => {
		// $inspect.trace must be the first statement of a function body
		$inspect.trace();
		doSomeWork();
	});
</script>
$inspect.trace takes an optional first argument which will be used as the label.

$host
When compiling a component as a custom element, the $host rune provides access to the host element, allowing you to (for example) dispatch custom events (demo):

Stepper

<svelte:options customElement="my-stepper" />

<script lang="ts">
	function dispatch(type) {
		$host().dispatchEvent(new CustomEvent(type));
	}
</script>

<button onclick={() => dispatch('decrement')}>decrement</button>
<button onclick={() => dispatch('increment')}>increment</button>
App

<script lang="ts">
	import './Stepper.svelte';

	let count = $state(0);
</script>

<my-stepper
	ondecrement={() => count -= 1}
	onincrement={() => count += 1}
></my-stepper>

<p>count: {count}</p>
