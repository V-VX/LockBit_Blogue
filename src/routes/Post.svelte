<script lang=ts>
	// /** @type {import('./$types').PageData} */
	import { page } from '$app/stores';

    export let title: String;
    export let uploaded_at: String;
    export let updated_at: String;
    // export let content: ConstructorOfATypedSvelteComponent;
    export let content: String;

</script>

<div class="post-info">
    <div class="post-img"></div>
    <div class="post-content">
        <div class="post-title">{ title }</div>
        <div class="post-main">
            <!-- <svelte:component this={content} /> -->
            {@html content}
        </div>
        <div class="dates">
            <div class="uploaded-at">
                <div class="uploaded-at-label">Uploaded:</div>
                <div class="uploaded-at-utc">{ uploaded_at }</div>
            </div>
            <div class="updated-at">
                <div class="updated-at-label">Updated:</div>
                <div class="updated-at-utc">{ updated_at }</div>
            </div>
        </div>
    </div>
</div>
<style>
    .post-info {
        padding: 20px;
        display: flex;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.04);
        border-radius: 4px;
        margin-bottom: 25px;
    }
    .dark .post-info {
        background: #1a1a1a;
    }
    .post-img {
        width: 200px;
        margin-right: 50px;
        text-align: center;
    }
    .post-content {
        width: calc(100% - 100px);
        overflow: hidden;
    }
    .post-title {
        font-weight: bold;
        font-size: 22px;
        letter-spacing: 0.03em;
        overflow: hidden;
        width: 658px;
        margin-right: 15px;
    }
    .dark .post-title {
        color: #f1f1f1;
    }
    .post-main {
        color: #333160;
    }
    .dark .post-main {
        color: #f1f1f1;
    }
    .dates {
        display: flex;
        font-family: Proxima Nova, sans-serif;
        font-size: 12px;
        opacity: 0.5;
        padding-top: 30px;
    }
    .uploaded-at {
        padding-right: 20px;
    }
    .uploaded-at-label {
        float: left;
        padding-right: 5px;
        text-transform: uppercase;
        font-size: 10px;
        font-family: Proxima Nova, sans-serif;
        font-weight: bold;
    }
    .uploaded-at-utc {
        text-transform: uppercase;
        font-size: 10px;
        font-family: Proxima Nova, sans-serif;
    }
    .updated-at {
        display: flex;
    }
    .updated-at-label {
        padding-right: 5px;
        text-align: center;
        text-transform: uppercase;
        font-size: 10px;
        font-family: Proxima Nova, sans-serif;
        font-weight: bold;
    }
    .updated-at-utc {
        text-align: center;
        text-transform: uppercase;
        font-size: 10px;
        font-family: Proxima Nova, sans-serif;
    }
</style>