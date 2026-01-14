<template>
  <div class="container">
    <div class="header">
      <div>
        <h1 class="title titleLarge">Fashion image Gen</h1>
        <p class="subtitle">
          Upload a garment image → auto-pick (or invent) model/background → generate a photorealistic look.
        </p>
      </div>
      <div class="badge" style="gap: 10px">
        <span>API key</span>
        <input
          class="control"
          :type="showApiKey ? 'text' : 'password'"
          v-model.trim="geminiApiKey"
          placeholder="Paste your key"
          style="width: 220px; padding: 8px 10px"
        />
        <button type="button" class="btnGhost" @click="showApiKey = !showApiKey">
          {{ showApiKey ? "Hide" : "Show" }}
        </button>
      </div>
    </div>

    <div class="tabRow">
      <div class="tabGroup" role="tablist" aria-label="Sections">
        <button
          type="button"
          @click="activeTab = 'generate'"
          :class="`tabButton ${activeTab === 'generate' ? 'tabButtonActive' : ''}`"
          role="tab"
          :aria-selected="activeTab === 'generate'"
        >
          Generate
        </button>
        <button
          type="button"
          @click="activeTab = 'assets'"
          :class="`tabButton ${activeTab === 'assets' ? 'tabButtonActive' : ''}`"
          role="tab"
          :aria-selected="activeTab === 'assets'"
        >
          Assets
        </button>
      </div>
    </div>

	    <div v-if="activeTab === 'generate'">
	      <div v-if="generateView === 'library'" class="storyboardLibrary">
	        <div class="card storyboardLibraryHeader">
	          <div>
	            <div class="sectionTitle" style="margin: 0 0 6px">Storyboards</div>
	            <div class="title" style="font-size: 18px; margin: 0">Pick an idea to continue</div>
	            <div class="muted" style="margin-top: 6px">Storyboards are stored locally in this browser.</div>
	          </div>
	          <button type="button" class="btnSecondary" @click="createNewStoryboard" :disabled="isGenerating">
	            New storyboard
	          </button>
	        </div>

	        <div class="storyboardGallery" role="list" aria-label="Storyboards">
	          <button
	            v-for="sb in storyboards"
	            :key="sb.id"
	            type="button"
	            :class="`storyboardCard ${sb.id === activeStoryboardId ? 'storyboardCardActive' : ''}`"
	            @click="openStoryboard(sb.id)"
	            role="listitem"
	            :disabled="isGenerating"
	          >
	            <div class="storyboardCardPreview" aria-hidden="true">
	              <template v-if="storyboardRuntime[sb.id]?.resultDataUrl">
	                <img :src="storyboardRuntime[sb.id].resultDataUrl ?? undefined" alt="" draggable="false" />
	              </template>
	              <template v-else-if="storyboardRuntime[sb.id]?.garmentDataUrls?.length">
	                <img
	                  :src="storyboardRuntime[sb.id].garmentDataUrls[0] ?? undefined"
	                  alt=""
	                  draggable="false"
	                />
	              </template>
	              <div v-else class="storyboardCardPreviewPlaceholder">No preview yet</div>
	            </div>

	            <div class="storyboardCardTop">
	              <div class="storyboardCardTitle">{{ sb.title }}</div>
	              <div class="storyboardCardMeta">{{ formatStoryboardTimestamp(sb.updatedAt) }}</div>
	            </div>
	            <div class="storyboardCardSub">{{ storyboardSubtitle(sb) }}</div>
	          </button>
	        </div>
	      </div>

	      <div v-else class="card storyboardEditorCard">
	        <div class="storyboardEditorCardHeader" aria-label="Storyboard manager">
	          <div class="storyboardEditorHeaderTop">
	            <button
	              type="button"
	              class="btnGhost storyboardBackButton"
	              @click="enterStoryboardLibrary"
	              :disabled="isGenerating"
	            >
	              ← Storyboards
	            </button>
	            <div class="badge" title="Saved locally in this browser">
	              <span>Saved locally</span>
	              <code>{{ formatStoryboardTimestamp(activeStoryboard.updatedAt) }}</code>
	            </div>
	          </div>

	          <div class="storyboardEditorHeaderMain">
	            <div class="storyboardEditorHeaderName">
	              <div class="sectionTitle" style="margin: 0 0 6px">Storyboard name</div>
	              <input class="control" v-model.trim="activeStoryboard.title" :disabled="isGenerating" />
	            </div>

	            <div class="storyboardEditorHeaderActions">
	              <button type="button" class="btnSecondary" @click="duplicateActiveStoryboard" :disabled="isGenerating">
	                Duplicate
	              </button>
	              <button
	                type="button"
	                class="btnDanger"
	                @click="requestDeleteActiveStoryboard"
	                :disabled="isGenerating || storyboards.length <= 1"
	              >
	                Delete
	              </button>
	            </div>
	          </div>

	          <div v-if="storyboards.length <= 1" class="muted" style="margin-top: -2px">
	            Keep at least one storyboard.
	          </div>
	        </div>

	        <div class="divider storyboardEditorDivider" aria-hidden="true" />

	        <div class="storyboardEditorCardBody">
	        <div class="grid storyBoard">
	        <div class="card">
	        <form @submit.prevent="onGenerateLook">
	          <fieldset class="formFieldset" :disabled="isGenerating">
	            <div>
	              <FieldLabel
		              htmlFor="garmentPhoto"
		              label="Garment photos"
		              info="Upload 1–4 photos of the SAME garment (front/side/back). The generator will preserve the garment silhouette and create a photorealistic ecommerce scene around it."
		            />
	            <input
	              id="garmentPhoto"
	              ref="garmentFileInputRef"
	              type="file"
	              accept="image/*"
	              multiple
	              @change="onGarmentFileChange"
	            />
	          </div>
	
	          <div v-if="activeRuntime.garmentDataUrls.length" style="margin-top: 12px">
	            <label>Garment preview</label>
	            <div class="preview previewGarments">
	              <img
	                v-for="(src, idx) in activeRuntime.garmentDataUrls"
	                :key="`${activeStoryboardId}-${idx}`"
	                :src="src"
	                :alt="`Garment angle ${idx + 1}`"
	              />
	            </div>
	            <div v-if="activeRuntime.garmentDataUrls.length < 3" class="muted" style="margin-top: 8px">
	              Tip: upload 3–4 angles (front/side/back) for better accuracy.
	            </div>
	          </div>

	          <div style="height: 18px" />

          <div class="sectionTitle">Creative Direction</div>

          <div>
            <FieldLabel
              label="Occasion (optional)"
              info="Sets the vibe for styling and scene (lighting, accessories, background mood). Pick a preset and optionally add extra detail (e.g., “sunset beach”, “nightclub”, “wedding guest”)."
            />
            <PillRadioGroup
              name="occasion"
              :model-value="activeConfig.occasionPreset"
              @update:model-value="activeConfig.occasionPreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'beachwear', label: 'Beachwear' },
                { value: 'party wear', label: 'Party wear' },
                { value: 'evening', label: 'Evening' },
                { value: 'casual', label: 'Casual' },
                { value: 'workwear', label: 'Workwear' },
                { value: 'resort vacation', label: 'Vacation' },
                { value: 'pool party', label: 'Pool Party' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="activeConfig.occasionDetails"
              placeholder="Optional: add details or type a custom occasion"
            />
          </div>

          <div style="height: 18px" />

          <div class="row">
            <div>
              <FieldLabel
                label="Color scheme (optional)"
                info="The overall color palette you want the model + background to lean into. This helps the generator choose complementary lighting and scene colors (e.g., “pastel”, “neutral”, “red & white”, “monochrome”)."
              />
              <input
                class="control"
                type="text"
                v-model="activeConfig.colorScheme"
                placeholder="e.g. red & white, pastel, neutral, monochrome"
              />
            </div>
            <div>
              <FieldLabel
                label="Accessories (optional)"
                info="Optional add-ons to make the scene feel complete (e.g., sunglasses, tote bag, heels). Keep it realistic and not too many items."
              />
              <input
                class="control"
                type="text"
                v-model="activeConfig.accessories"
                placeholder="comma separated, e.g. straw hat, sandals"
              />
            </div>
          </div>

          <div style="height: 18px" />

          <div>
            <FieldLabel
              label="Style keywords (optional)"
              info="A few words describing the aesthetic. This influences pose, lighting, props, and overall styling (e.g., minimal, luxury, streetwear). Choose a direction and optionally add extra keywords."
            />
            <PillRadioGroup
              name="styleKeywords"
              :model-value="activeConfig.stylePreset"
              @update:model-value="activeConfig.stylePreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'streetwear', label: 'Streetwear' },
                { value: 'luxe', label: 'Luxury' },
                { value: 'boho', label: 'Boho' },
                { value: 'earthy and tropical', label: 'Earthy / Tropical' },
                { value: 'warm and vibrant', label: 'Warm & Vibrant' },
                { value: 'romantic', label: 'Romantic' },
                { value: 'natural glam', label: 'Natural Glam' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="activeConfig.styleKeywordsDetails"
              placeholder="Optional: add keywords (comma separated)"
            />
          </div>

          <div style="height: 18px" />

          <div class="divider" />

          <div style="height: 18px" />

          <div class="sectionTitle">Background</div>

          <div>
            <FieldLabel
              label="Background theme (optional)"
              info="Describes the environment you want (e.g., studio, beach, rooftop, garden). Pick a preset and optionally add extra detail. If you select an uploaded background thumbnail below, that image will be used as the scene reference."
            />
            <PillRadioGroup
              name="backgroundTheme"
              :model-value="activeConfig.backgroundThemePreset"
              @update:model-value="activeConfig.backgroundThemePreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'studio', label: 'Studio' },
                { value: 'beach', label: 'Beach' },
                { value: 'sunset shoreline', label: 'Sunset Shoreline' },
                { value: 'arcade', label: 'Arcade' },
                { value: 'city street', label: 'City' },
                { value: 'garden', label: 'Garden' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'luxury', label: 'Luxury' },
                { value: 'mediterranean terrace', label: 'Mediterranean Terrace' },
                { value: 'concert', label: 'Concert' },
                { value: 'nightclub', label: 'Nightlife' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="activeConfig.backgroundThemeDetails"
              placeholder="Optional: add details (lighting, location, props)"
            />
          </div>

          <div style="height: 18px" />

          <div>
            <FieldLabel
              label="Background image (optional)"
              info="If you have added backgrounds in the Assets tab, click a thumbnail to force a specific scene. Leave on Auto to let the generator invent a matching background."
            />
            <div v-if="backgrounds.length" class="thumbStrip">
              <button
                type="button"
                :class="`thumb ${!activeConfig.selectedBackgroundId ? 'thumbSelected' : ''}`"
                @click="activeConfig.selectedBackgroundId = ''"
                :aria-pressed="!activeConfig.selectedBackgroundId"
                title="Auto background"
              >
                <div class="thumbPlaceholder">Auto</div>
                <div class="thumbTitle">Auto</div>
                <div class="thumbSubtitle">Invent / pick best</div>
              </button>
              <button
                v-for="b in backgrounds"
                :key="b.id"
                type="button"
                :class="`thumb ${activeConfig.selectedBackgroundId === b.id ? 'thumbSelected' : ''}`"
                @click="activeConfig.selectedBackgroundId = b.id"
                :aria-pressed="activeConfig.selectedBackgroundId === b.id"
                :title="b.title"
              >
                <img :src="b.image_url" :alt="b.title" loading="lazy" />
                <div class="thumbTitle">{{ b.title }}</div>
                <div class="thumbSubtitle">{{ b.theme || "Background" }}</div>
              </button>
            </div>
            <div v-else class="muted">No backgrounds detected — the generator will invent one.</div>
          </div>

          <div style="height: 18px" />

          <div class="divider" />

          <div style="height: 18px" />

          <div class="sectionTitle">Model</div>

          <div>
            <FieldLabel
              label="Model (optional)"
              info="Use this to bias the generated model (ethnicity / vibe) when you are not selecting a specific model image. Pick a preset and/or add your own description."
            />
            <PillRadioGroup
              name="modelPreference"
              :model-value="activeConfig.modelPreset"
              @update:model-value="activeConfig.modelPreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'South Asian', label: 'South Asian' },
                { value: 'East Asian', label: 'East Asian' },
                { value: 'Black', label: 'Black' },
                { value: 'White / European', label: 'White / European' },
                { value: 'Middle Eastern', label: 'Middle Eastern' },
                { value: 'Latina', label: 'Latina' },
                { value: 'custom', label: 'Custom' },
              ]"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="activeConfig.modelDetails"
              placeholder="Optional: add model description (ethnicity, vibe, etc.)"
            />
          </div>

          <div style="height: 18px" />

          <div>
            <FieldLabel
              label="Model image (optional)"
              info="If you have added model references in the Assets tab, click a thumbnail to use that exact identity/face/pose. Leave Auto to generate a suitable model."
            />
            <div v-if="models.length" class="thumbStrip">
              <button
                type="button"
                :class="`thumb ${!activeConfig.selectedModelId ? 'thumbSelected' : ''}`"
                @click="activeConfig.selectedModelId = ''"
                :aria-pressed="!activeConfig.selectedModelId"
                title="Auto model"
              >
                <div class="thumbPlaceholder">Auto</div>
                <div class="thumbTitle">Auto</div>
                <div class="thumbSubtitle">Invent / pick best</div>
              </button>
              <button
                v-for="m in models"
                :key="m.id"
                type="button"
                :class="`thumb ${activeConfig.selectedModelId === m.id ? 'thumbSelected' : ''}`"
                @click="activeConfig.selectedModelId = m.id"
                :aria-pressed="activeConfig.selectedModelId === m.id"
                :title="m.title"
              >
                <img :src="m.image_url" :alt="m.title" loading="lazy" />
                <div class="thumbTitle">{{ m.title }}</div>
                <div class="thumbSubtitle">{{ m.ethnicity || "Model" }}</div>
              </button>
            </div>
            <div v-else class="muted">No models detected — the generator will invent one.</div>
          </div>

          <div style="height: 18px" />

	          <div class="row">
	            <div>
	              <FieldLabel
	                label="Model styling notes (optional)"
	                info="Pick a preset for hair/makeup/jewelry, and optionally add your own notes. If you set both, they will be combined."
	              />
	              <PillRadioGroup
	                name="modelStyling"
	                :model-value="activeConfig.modelStylingPreset"
	                @update:model-value="activeConfig.modelStylingPreset = $event"
	                :options="[
	                  { value: '', label: 'Auto' },
	                  { value: 'natural glam', label: 'Natural glam' },
	                  { value: 'minimal jewelry', label: 'Minimal jewelry' },
	                  { value: 'hair up', label: 'Hair up' },
	                  { value: 'beachy', label: 'Beachy' },
	                  { value: 'sleek', label: 'Sleek' },
	                  { value: 'custom', label: 'Custom' },
	                ]"
	              />
	              <div style="height: 14px" />
	              <input
	                class="control"
	                type="text"
	                v-model="activeConfig.modelStylingNotes"
	                placeholder="Optional: add your own notes (hair/makeup/jewelry, vibe)"
	              />
	            </div>
	            <div>
	              <FieldLabel
	                label="Debug (optional)"
	                info="When enabled, the UI shows internal prompt/plan details to help iterate on results."
              />
              <select class="control" v-model="activeConfig.includeDebugStr">
                <option value="no">Off</option>
                <option value="yes">On (show prompts)</option>
              </select>
            </div>
          </div>

          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="isGenerating">
              {{ isGenerating ? "Generating..." : "Generate look" }}
            </button>
            <button type="button" class="btnSecondary" @click="refreshAssets" :disabled="isGenerating">
              Refresh assets
            </button>
          </div>

          <div v-if="assetsError" class="error">{{ assetsError }}</div>
          <div v-if="activeRuntime.generateError" class="error">{{ activeRuntime.generateError }}</div>

	          <div v-if="activeRuntime.garmentDataUrls.length" style="margin-top: 16px">
	            <label>Selection preview</label>
	            <div class="muted">
	              {{ activeConfig.selectedBackgroundId ? "Using selected background." : "Auto background." }}
	              {{ " " }}
	              {{ activeConfig.selectedModelId ? "Using selected model." : "Auto model." }}
	            </div>
	          </div>

          <div v-if="activeRuntime.chosenSummary" style="margin-top: 12px">
            <label>Chosen plan</label>
            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(activeRuntime.chosenSummary, null, 2) }}</pre>
          </div>

	          <div v-if="activeRuntime.debugSummary" style="margin-top: 12px">
	            <label>Debug</label>
	            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(activeRuntime.debugSummary, null, 2) }}</pre>
	          </div>
	          </fieldset>
	        </form>
	      </div>

      <div class="card result">
        <FieldLabel
          label="Generated result"
          info="Your generated ecommerce scene will appear here. For best results, start with Auto settings and only lock in a background/model when you need consistency."
        />

        <div v-if="isGenerating" class="resultPlaceholder loaderPlaceholder">
          <div class="loader">
            <div class="loaderHeader">
              <Spinner />
              <div>
                <div class="loaderTitle">{{ GENERATION_STEPS[generationStepIndex] }}</div>
                <div class="loaderSubtitle">Elapsed {{ formatDurationMs(generationElapsedMs) }}</div>
              </div>
            </div>

            <div class="loaderSteps" aria-label="Generation progress">
              <div
                v-for="(label, idx) in GENERATION_STEPS"
                :key="label"
                :class="idx < generationStepIndex ? 'loaderStep loaderStepDone' : idx === generationStepIndex ? 'loaderStep loaderStepActive' : 'loaderStep'"
              >
                <div class="loaderDot" aria-hidden="true" />
                <div class="loaderStepText">{{ label }}</div>
              </div>
            </div>

            <div class="loaderHint muted">Keep this tab open while we generate your image.</div>
          </div>
        </div>

        <template v-else-if="activeRuntime.resultDataUrl">
          <div class="resultActions">
            <div class="resultActionsLeft">
              <a
                class="btn btnSecondary"
                :href="activeRuntime.resultDataUrl"
                :download="`look-${Date.now()}.${mimeToExtension(activeRuntime.resultMimeType)}`"
              >
                Download
              </a>
              <button type="button" class="btnGhost" @click="clearResult">Clear</button>
            </div>
            <div class="resultActionsRight">
              <div v-if="activeRuntime.resultTimingsMs" class="badge" title="Time spent generating this image">
                <span>Thinking</span>
                <code>{{ formatDurationMs(computedTimings.textLlmMs) }}</code>
                <span>Image gen</span>
                <code>{{ formatDurationMs(computedTimings.imageGenMs) }}</code>
                <span>Total</span>
                <code>{{ formatDurationMs(computedTimings.totalMs) }}</code>
              </div>
              <div class="muted">Tip: use “Debug” to inspect prompts.</div>
            </div>
          </div>
          <div
            class="resultImageZoom"
            @pointermove="onResultImagePointerMove"
            @pointerleave="onResultImagePointerLeave"
          >
            <img class="resultImage" :src="activeRuntime.resultDataUrl" alt="Generated look" draggable="false" />
          </div>
        </template>

        <div v-else class="resultPlaceholder resultEmpty">
          <div>
            <div class="resultEmptyTitle">Ready when you are</div>
            <div class="muted">Upload a garment photo, then click “Generate look”.</div>
          </div>
        </div>
	      </div>
	    </div>
	    </div>
	    </div>
	    </div>
	
	    <div v-else class="grid">
	      <div class="card">
	        <h2 class="title" style="font-size: 16px; margin-top: 0">Upload background</h2>
        <form @submit.prevent="uploadBackground">
          <div>
            <FieldLabel
              label="Image"
              info="Upload a background reference image (e.g., studio wall, beach, garden). Stored locally in your browser and selectable from the Generate tab."
            />
            <input ref="bgFileInputRef" type="file" accept="image/*" @change="onBgFileChange" />
          </div>
          <div style="height: 18px" />
          <div class="row">
            <div>
              <FieldLabel label="Title (optional)" info="A short name to recognize this background." />
              <input class="control" v-model="bgTitle" type="text" />
            </div>
            <div>
              <FieldLabel
                label="Theme (recommended)"
                info="A theme tag (e.g., beach, party, studio). The generator can use this when auto-planning a look."
              />
              <input class="control" v-model="bgTheme" type="text" placeholder="beach, party, forest..." />
            </div>
          </div>
          <div style="height: 18px" />
          <div>
            <FieldLabel label="Tags (optional)" info="Extra tags to help categorize assets. Use commas." />
            <input class="control" v-model="bgTags" type="text" placeholder="comma separated" />
          </div>
          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="bgUploading">
              {{ bgUploading ? "Uploading..." : "Upload background" }}
            </button>
          </div>
          <div v-if="bgUploadError" class="error">{{ bgUploadError }}</div>
        </form>
      </div>

      <div class="card">
        <h2 class="title" style="font-size: 16px; margin-top: 0">Upload model</h2>
        <form @submit.prevent="uploadModel">
          <div>
            <FieldLabel
              label="Image"
              info="Upload a model reference image to keep the same identity/face/pose across generations. Stored locally in your browser."
            />
            <input ref="modelFileInputRef" type="file" accept="image/*" @change="onModelFileChange" />
          </div>
          <div style="height: 18px" />
          <div class="row">
            <div>
              <FieldLabel label="Title (optional)" info="A short name to recognize this model." />
              <input class="control" v-model="modelTitle" type="text" />
            </div>
            <div>
              <FieldLabel
                label="Ethnicity (recommended)"
                info="Helps the generator auto-pick diversity when no explicit model is selected."
              />
              <input class="control" v-model="modelAssetEthnicity" type="text" placeholder="Indian, Russian..." />
            </div>
          </div>
          <div style="height: 18px" />
          <div>
            <FieldLabel label="Tags (optional)" info="Extra tags to help categorize assets. Use commas." />
            <input class="control" v-model="modelTags" type="text" placeholder="comma separated" />
          </div>
          <div class="actions">
            <button type="submit" class="btnPrimary" :disabled="modelUploading">
              {{ modelUploading ? "Uploading..." : "Upload model" }}
            </button>
          </div>
          <div v-if="modelUploadError" class="error">{{ modelUploadError }}</div>
        </form>
      </div>

      <div class="card" style="grid-column: 1 / -1">
        <div class="actions" style="justify-content: space-between">
          <div>
            <h2 class="title" style="font-size: 16px; margin: 0">Current assets</h2>
            <div class="muted">Backgrounds: {{ backgrounds.length }} · Models: {{ models.length }}</div>
          </div>
          <button type="button" class="btnSecondary" @click="refreshAssets">Refresh</button>
        </div>

        <div v-if="assetsError" class="error">{{ assetsError }}</div>

        <div style="height: 18px" />

        <div class="grid">
          <div>
            <label>Backgrounds</label>
            <div class="preview">
              <img v-for="b in backgrounds" :key="b.id" :src="b.image_url" :alt="b.title" :title="b.title" />
            </div>
          </div>
          <div>
            <label>Models</label>
            <div class="preview">
              <img v-for="m in models" :key="m.id" :src="m.image_url" :alt="m.title" :title="m.title" />
            </div>
          </div>
        </div>
	      </div>
	    </div>

	    <div
	      v-if="deleteStoryboardModalOpen"
	      class="modalOverlay"
	      role="dialog"
	      aria-modal="true"
	      aria-label="Delete storyboard"
	      @click.self="closeDeleteStoryboardModal"
	    >
	      <div class="modalCard">
	        <div class="modalTitle">Delete storyboard?</div>
	        <div class="muted" style="margin-top: 6px">
	          This removes <strong>{{ activeStoryboard.title }}</strong> from this browser. Background/model assets remain.
	        </div>
	        <div class="actions" style="justify-content: flex-end; margin-top: 16px">
	          <button type="button" class="btnSecondary" @click="closeDeleteStoryboardModal">Cancel</button>
	          <button type="button" class="btnDanger" @click="confirmDeleteActiveStoryboard">Delete</button>
	        </div>
	      </div>
	    </div>
	  </div>
	</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import FieldLabel from "./components/FieldLabel.vue";
import PillRadioGroup from "./components/PillRadioGroup.vue";
import Spinner from "./components/Spinner.vue";

import { base64ToBytes, dataUrlToInlineImage, generateImage } from "./lib/gemini";
import {
  fileToDataUrl,
  listAssets,
  nowIso,
  parseTags as parseLocalTags,
  randomId,
  upsertAsset,
  type LocalAsset,
} from "./lib/localAssets";
import {
  createStoryboardRecord,
  loadActiveStoryboardIdFromLocalStorage,
  loadStoryboardsFromLocalStorage,
  saveActiveStoryboardIdToLocalStorage,
  saveStoryboardsToLocalStorage,
  type StoryboardRecord,
} from "./lib/storyboards";
import {
  applyFreeformOverrides,
  buildCompositePrompt,
  buildGarmentReferencePrompt,
  chooseBackground,
  chooseModel,
  computeTimingsMs,
  generateFinalPrompt,
  planLookFromGarment,
  type AssetMeta,
  type LookPlan,
} from "./lib/pipeline";

const GENERATION_STEPS = [
  "Getting all the configurations",
  "Thinking",
  "Compositing a scene",
  "Generating image",
] as const;

function mimeToExtension(mimeType: string | null): string {
  const mt = (mimeType || "").toLowerCase().trim();
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  return "png";
}

function formatDurationMs(ms: number | null | undefined): string {
  const safe = typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
  const seconds = safe / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds - wholeMinutes * 60);
  return `${wholeMinutes}m ${remainingSeconds}s`;
}

function combinePresetAndCustom(opts: { presetText: string; customText: string; joiner?: string }): string {
  const p = (opts.presetText || "").trim();
  const c = (opts.customText || "").trim();
  if (!p) return c;
  if (!c) return p;
  return `${p}${opts.joiner ?? ", "}${c}`;
}

	const activeTab = ref<"generate" | "assets">("generate");
	const generateView = ref<"library" | "editor">("library");

const geminiApiKey = ref(localStorage.getItem("gemini_api_key") || "");
const showApiKey = ref(false);
watch(
  geminiApiKey,
  (value) => {
    const trimmed = (value || "").trim();
    localStorage.setItem("gemini_api_key", trimmed);
  },
  { flush: "post" },
);

	type StoryboardRuntime = {
	  garmentDataUrls: string[];
	  garmentFileNames: string[];
	  generateError: string | null;
	  chosenSummary: any;
	  debugSummary: any;
	  resultDataUrl: string | null;
	  resultMimeType: string | null;
	  resultTimingsMs: Record<string, number> | null;
	};

	function createDefaultRuntime(): StoryboardRuntime {
	  return {
	    garmentDataUrls: [],
	    garmentFileNames: [],
	    generateError: null,
	    chosenSummary: null,
	    debugSummary: null,
	    resultDataUrl: null,
	    resultMimeType: null,
	    resultTimingsMs: null,
	  };
	}

const storyboards = ref<StoryboardRecord[]>([]);
const activeStoryboardId = ref("");

function loadInitialStoryboards(): { storyboards: StoryboardRecord[]; activeId: string } {
  const loaded = loadStoryboardsFromLocalStorage();
  const ensured = loaded.length ? loaded : [createStoryboardRecord({ title: "Storyboard 1" })];

  const savedActive = loadActiveStoryboardIdFromLocalStorage();
  const activeId =
    savedActive && ensured.some((sb) => sb.id === savedActive) ? savedActive : ensured[0]!.id;

  return { storyboards: ensured, activeId };
}

const initialStoryboards = loadInitialStoryboards();
storyboards.value = initialStoryboards.storyboards;
activeStoryboardId.value = initialStoryboards.activeId;

const storyboardRuntime = ref<Record<string, StoryboardRuntime>>(
  Object.fromEntries(storyboards.value.map((sb) => [sb.id, createDefaultRuntime()])),
);

const activeStoryboard = computed(() => {
  const found = storyboards.value.find((sb) => sb.id === activeStoryboardId.value);
  return found || storyboards.value[0]!;
});

const activeConfig = computed(() => activeStoryboard.value.config);
const activeRuntime = computed(() => storyboardRuntime.value[activeStoryboardId.value]!);
const includeDebug = computed(() => activeConfig.value.includeDebugStr === "yes");

const deleteStoryboardModalOpen = ref(false);

function safeClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function formatStoryboardTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

	function storyboardSubtitle(sb: StoryboardRecord): string {
	  const cfg = sb.config;
	  const parts: string[] = [];

	  const occasion =
	    cfg.occasionPreset === "custom"
	      ? cfg.occasionDetails.trim()
	      : combinePresetAndCustom({ presetText: cfg.occasionPreset, customText: cfg.occasionDetails, joiner: ", " });
	  if (occasion) parts.push(`Occasion: ${occasion}`);

	  const color = cfg.colorScheme.trim();
	  if (color) parts.push(`Colors: ${color}`);

	  const stylePresetText =
	    cfg.stylePreset && cfg.stylePreset !== "custom" ? stylePresetKeywords[cfg.stylePreset] ?? cfg.stylePreset : "";
	  const styleKeywords =
	    cfg.stylePreset === "custom"
	      ? cfg.styleKeywordsDetails.trim()
	      : combinePresetAndCustom({ presetText: stylePresetText, customText: cfg.styleKeywordsDetails, joiner: ", " });
	  if (styleKeywords) parts.push(`Style: ${styleKeywords}`);

	  const bgTheme =
	    cfg.backgroundThemePreset === "custom"
	      ? cfg.backgroundThemeDetails.trim()
	      : combinePresetAndCustom({
	          presetText: cfg.backgroundThemePreset,
	          customText: cfg.backgroundThemeDetails,
	          joiner: ", ",
	        });
	  if (bgTheme) parts.push(`BG: ${bgTheme}`);
	  if (cfg.selectedBackgroundId) parts.push("BG pinned");

	  const accessories = cfg.accessories.trim();
	  if (accessories) parts.push(`Accessories: ${accessories}`);

	  const ethnicity =
	    cfg.modelPreset === "custom"
	      ? cfg.modelDetails.trim()
	      : combinePresetAndCustom({ presetText: cfg.modelPreset, customText: cfg.modelDetails, joiner: ", " });
	  if (ethnicity) parts.push(`Model: ${ethnicity}`);
	  if (cfg.selectedModelId) parts.push("Model pinned");

	  const stylingPresetText =
	    cfg.modelStylingPreset && cfg.modelStylingPreset !== "custom"
	      ? modelStylingPresetKeywords[cfg.modelStylingPreset] ?? cfg.modelStylingPreset
	      : "";
	  const styling =
	    cfg.modelStylingPreset === "custom"
	      ? cfg.modelStylingNotes.trim()
	      : combinePresetAndCustom({
	          presetText: stylingPresetText,
	          customText: cfg.modelStylingNotes,
	          joiner: ", ",
	        });
	  if (styling) parts.push(`Styling: ${styling}`);

	  return parts.join("\n") || "No settings yet";
	}

	function selectStoryboard(id: string) {
	  if (isGenerating.value) return;
	  if (!storyboards.value.some((sb) => sb.id === id)) return;
	  activeStoryboardId.value = id;
	}

	function openStoryboard(id: string) {
	  if (isGenerating.value) return;
	  if (!storyboards.value.some((sb) => sb.id === id)) return;
	  activeStoryboardId.value = id;
	  generateView.value = "editor";
	}

	function enterStoryboardLibrary() {
	  if (isGenerating.value) return;
	  generateView.value = "library";
	}

function uniqueTitle(base: string): string {
  const cleanedBase = (base || "").trim() || "Storyboard";
  const existing = new Set(storyboards.value.map((sb) => sb.title.trim().toLowerCase()).filter(Boolean));
  if (!existing.has(cleanedBase.toLowerCase())) return cleanedBase;

  let n = 2;
  while (existing.has(`${cleanedBase} ${n}`.toLowerCase())) n += 1;
  return `${cleanedBase} ${n}`;
}

	function createNewStoryboard() {
	  const sb = createStoryboardRecord({ title: uniqueTitle(`Storyboard ${storyboards.value.length + 1}`) });
	  storyboards.value.unshift(sb);
	  storyboardRuntime.value[sb.id] = createDefaultRuntime();
	  activeStoryboardId.value = sb.id;
	  generateView.value = "editor";
	}

	function duplicateActiveStoryboard() {
	  const src = activeStoryboard.value;
	  const dst = createStoryboardRecord({ title: uniqueTitle(`${src.title} (copy)`), config: { ...src.config } });
	  storyboards.value.unshift(dst);
	  storyboardRuntime.value[dst.id] = {
	    ...createDefaultRuntime(),
	    garmentDataUrls: [...activeRuntime.value.garmentDataUrls],
	    garmentFileNames: [...activeRuntime.value.garmentFileNames],
	    chosenSummary: safeClone(activeRuntime.value.chosenSummary),
	    debugSummary: safeClone(activeRuntime.value.debugSummary),
	    resultDataUrl: activeRuntime.value.resultDataUrl,
	    resultMimeType: activeRuntime.value.resultMimeType,
	    resultTimingsMs: activeRuntime.value.resultTimingsMs ? { ...activeRuntime.value.resultTimingsMs } : null,
	  };
	  activeStoryboardId.value = dst.id;
	}

function requestDeleteActiveStoryboard() {
  if (storyboards.value.length <= 1) return;
  deleteStoryboardModalOpen.value = true;
}

function closeDeleteStoryboardModal() {
  deleteStoryboardModalOpen.value = false;
}

function confirmDeleteActiveStoryboard() {
  const id = activeStoryboardId.value;
  if (!id) return;
  if (storyboards.value.length <= 1) {
    deleteStoryboardModalOpen.value = false;
    return;
  }

  const idx = storyboards.value.findIndex((sb) => sb.id === id);
  if (idx !== -1) storyboards.value.splice(idx, 1);
  delete storyboardRuntime.value[id];

  const next = storyboards.value[Math.max(0, idx - 1)] || storyboards.value[0];
  if (next) activeStoryboardId.value = next.id;

  deleteStoryboardModalOpen.value = false;
}

let storyboardSaveTimer: number | null = null;

function schedulePersistStoryboards() {
  if (storyboardSaveTimer) window.clearTimeout(storyboardSaveTimer);
  storyboardSaveTimer = window.setTimeout(() => {
    try {
      saveStoryboardsToLocalStorage(storyboards.value);
    } catch {
      // Ignore localStorage quota errors; storyboards will remain in memory.
    }
  }, 250);
}

watch(activeStoryboardId, (id) => saveActiveStoryboardIdToLocalStorage(id), { flush: "post" });
watch(storyboards, schedulePersistStoryboards, { deep: true, flush: "post" });

watch(
  () => [activeStoryboardId.value, activeStoryboard.value.title, activeStoryboard.value.config] as const,
  (next, prev) => {
    if (!prev) return;
    if (next[0] !== prev[0]) return;
    activeStoryboard.value.updatedAt = nowIso();
  },
  { deep: true, flush: "post" },
);

// Ensure persisted defaults exist for first-time users.
try {
  saveStoryboardsToLocalStorage(storyboards.value);
  saveActiveStoryboardIdToLocalStorage(activeStoryboardId.value);
} catch {
  // Ignore localStorage quota errors; storyboards will remain in memory.
}

const garmentFileInputRef = ref<HTMLInputElement | null>(null);

	async function onGarmentFileChange(e: Event) {
	  const input = e.target as HTMLInputElement | null;
	  const files = Array.from(input?.files ?? []);
	  const storyboardId = activeStoryboardId.value;
	  const runtime = storyboardRuntime.value[storyboardId];
	  if (!runtime) return;

	  runtime.generateError = null;

	  if (!files.length) {
	    runtime.garmentDataUrls = [];
	    runtime.garmentFileNames = [];
	    return;
	  }

	  const limited = files.slice(0, 4);
	  runtime.garmentFileNames = limited.map((f) => f.name || "garment");
	  runtime.garmentDataUrls = await Promise.all(limited.map((f) => fileToDataUrl(f)));

	  if (input) input.value = "";
	}

const isGenerating = ref(false);

const generationStepIndex = ref(0);
const generationElapsedMs = ref(0);
let generationInterval: number | null = null;

function startGenerationTimer() {
  if (generationInterval) window.clearInterval(generationInterval);
  const startedAt = performance.now();
  generationElapsedMs.value = 0;
  generationInterval = window.setInterval(() => {
    generationElapsedMs.value = performance.now() - startedAt;
  }, 100);
}

function stopGenerationTimer() {
  if (generationInterval) window.clearInterval(generationInterval);
  generationInterval = null;
}

onBeforeUnmount(() => {
  if (generationInterval) window.clearInterval(generationInterval);
  if (storyboardSaveTimer) window.clearTimeout(storyboardSaveTimer);
});

function clearResult() {
  const runtime = activeRuntime.value;
  runtime.resultDataUrl = null;
  runtime.resultMimeType = null;
  runtime.chosenSummary = null;
  runtime.debugSummary = null;
  runtime.resultTimingsMs = null;
  runtime.generateError = null;
}

function onResultImagePointerMove(event: PointerEvent) {
  if (event.pointerType && event.pointerType !== "mouse") return;
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  const clampedX = Math.max(0, Math.min(100, x));
  const clampedY = Math.max(0, Math.min(100, y));
  el.style.setProperty("--zoom-x", `${clampedX.toFixed(2)}%`);
  el.style.setProperty("--zoom-y", `${clampedY.toFixed(2)}%`);
}

function onResultImagePointerLeave(event: PointerEvent) {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return;
  el.style.setProperty("--zoom-x", "50%");
  el.style.setProperty("--zoom-y", "50%");
}

const computedTimings = computed(() => computeTimingsMs(activeRuntime.value.resultTimingsMs || {}));

// Local assets (IndexedDB)
const backgrounds = ref<LocalAsset[]>([]);
const models = ref<LocalAsset[]>([]);
const assetsError = ref<string | null>(null);

async function refreshAssets() {
  assetsError.value = null;
  try {
    const [bg, md] = await Promise.all([listAssets("background"), listAssets("model")]);
    backgrounds.value = bg;
    models.value = md;
  } catch (err: any) {
    assetsError.value = err?.message || String(err);
  }
}

onMounted(() => {
  void refreshAssets();
});

function assetMetaFromLocal(a: LocalAsset): AssetMeta {
  return {
    id: a.id,
    title: a.title,
    theme: a.theme ?? null,
    ethnicity: a.ethnicity ?? null,
    tags: a.tags || [],
  };
}

function getSelectedBackground(desiredTheme: string): LocalAsset | null {
  const selected = activeConfig.value.selectedBackgroundId;
  if (selected) {
    return backgrounds.value.find((b) => b.id === selected) || null;
  }
  if (!backgrounds.value.length) return null;
  const chosen = chooseBackground(backgrounds.value.map(assetMetaFromLocal), desiredTheme);
  return chosen ? backgrounds.value.find((b) => b.id === chosen.id) || null : null;
}

function getSelectedModel(planEthnicity: string): LocalAsset | null {
  const selected = activeConfig.value.selectedModelId;
  if (selected) {
    return models.value.find((m) => m.id === selected) || null;
  }
  if (!models.value.length) return null;
  const chosen = chooseModel(models.value.map(assetMetaFromLocal), planEthnicity);
  return chosen ? models.value.find((m) => m.id === chosen.id) || null : null;
}

// Derived inputs
const occasionFinal = computed(() =>
  activeConfig.value.occasionPreset === "custom"
    ? activeConfig.value.occasionDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.occasionPreset,
        customText: activeConfig.value.occasionDetails,
        joiner: ", ",
      }),
);

const stylePresetKeywords: Record<string, string> = {
  minimal: "minimal, clean, modern",
  streetwear: "streetwear, edgy, urban",
  luxe: "luxury, premium, editorial",
  boho: "boho, relaxed, earthy",
  vintage: "vintage, retro",
  sporty: "sporty, athleisure",
  romantic: "romantic, feminine",
  edgy: "edgy, bold, high-contrast",
};

const stylePresetText = computed(() =>
  activeConfig.value.stylePreset && activeConfig.value.stylePreset !== "custom"
    ? stylePresetKeywords[activeConfig.value.stylePreset] ?? activeConfig.value.stylePreset
    : "",
);

const styleKeywordsFinal = computed(() =>
  activeConfig.value.stylePreset === "custom"
    ? activeConfig.value.styleKeywordsDetails.trim()
    : combinePresetAndCustom({
        presetText: stylePresetText.value,
        customText: activeConfig.value.styleKeywordsDetails,
        joiner: ", ",
      }),
);

const backgroundThemeFinal = computed(() =>
  activeConfig.value.backgroundThemePreset === "custom"
    ? activeConfig.value.backgroundThemeDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.backgroundThemePreset,
        customText: activeConfig.value.backgroundThemeDetails,
        joiner: ", ",
      }),
);

	const modelEthnicityFinal = computed(() =>
	  activeConfig.value.modelPreset === "custom"
	    ? activeConfig.value.modelDetails.trim()
	    : combinePresetAndCustom({
	        presetText: activeConfig.value.modelPreset,
	        customText: activeConfig.value.modelDetails,
	        joiner: ", ",
	      }),
	);

	const modelStylingPresetKeywords: Record<string, string> = {
	  "natural glam": "natural glam makeup, clean dewy skin, minimal jewelry",
	  "minimal jewelry": "minimal jewelry, clean makeup, polished hair",
	  "hair up": "hair up (sleek bun or ponytail), minimal jewelry, natural makeup",
	  "beachy": "beachy waves, sun-kissed natural makeup, minimal jewelry",
	  "sleek": "sleek straight hair, defined brows, neutral lip, minimal jewelry",
	};

	const modelStylingPresetText = computed(() =>
	  activeConfig.value.modelStylingPreset && activeConfig.value.modelStylingPreset !== "custom"
	    ? modelStylingPresetKeywords[activeConfig.value.modelStylingPreset] ?? activeConfig.value.modelStylingPreset
	    : "",
	);

	const modelStylingNotesFinal = computed(() =>
	  activeConfig.value.modelStylingPreset === "custom"
	    ? activeConfig.value.modelStylingNotes.trim()
	    : combinePresetAndCustom({
	        presetText: modelStylingPresetText.value,
	        customText: activeConfig.value.modelStylingNotes,
	        joiner: ", ",
	      }),
	);

async function onGenerateLook() {
  const runtime = activeRuntime.value;

  runtime.generateError = null;
  runtime.chosenSummary = null;
  runtime.debugSummary = null;
  runtime.resultDataUrl = null;
  runtime.resultMimeType = null;
  runtime.resultTimingsMs = null;

  if (!geminiApiKey.value.trim()) {
    runtime.generateError = "Please paste your API key (BYO key).";
    return;
  }
	    if (!runtime.garmentDataUrls.length) {
	      runtime.generateError = "Please select a garment photo.";
	      return;
	    }

  isGenerating.value = true;
  generationStepIndex.value = 0;
  startGenerationTimer();

  const timings: Record<string, number> = {};
  const debug: any = {};
  let planError: string | null = null;

  try {
    generationStepIndex.value = 0;

	    const garmentDataUrls = runtime.garmentDataUrls;
	    if (!garmentDataUrls.length) {
	      runtime.generateError = "Please select garment photos.";
	      return;
	    }
	    const garmentInlines = garmentDataUrls.map((src) => dataUrlToInlineImage(src));

    const availableThemes = Array.from(
      new Set(backgrounds.value.map((b) => (b.theme || "").trim()).filter(Boolean)),
    ).sort();
    const availableEthnicities = Array.from(
      new Set(models.value.map((m) => (m.ethnicity || "").trim()).filter(Boolean)),
    ).sort();

    generationStepIndex.value = 1;

	    const userOverrides = {
	      occasion: occasionFinal.value || null,
	      color_scheme: activeConfig.value.colorScheme.trim() || null,
	      background_theme: backgroundThemeFinal.value || null,
	      model_ethnicity: modelEthnicityFinal.value || null,
	      model_styling_notes: modelStylingNotesFinal.value || null,
	    };

    let plan: LookPlan;
    const tPlan0 = performance.now();
    try {
	      const planRes = await planLookFromGarment({
	        apiKey: geminiApiKey.value,
	        model: "gemini-3-flash-preview",
	        garmentImages: garmentInlines,
	        availableBackgroundThemes: availableThemes,
	        availableModelEthnicities: availableEthnicities,
	        userOverrides,
	        timeoutMs: 120_000,
	      });
      plan = planRes.plan;
      debug.plan_raw_text = planRes.rawText;
      debug.plan_raw_json = planRes.rawJson;
    } catch (err: any) {
      planError = err?.message || String(err);
      const ov = userOverrides;
      plan = {
        occasion: ov.occasion || "casual",
        color_scheme: ov.color_scheme || "neutral",
        print_style: "as-is",
        style_keywords: [],
        background_theme: ov.background_theme || ov.occasion || "casual",
        accessories: [],
        negative_prompt:
          "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark",
        model_ethnicity: ov.model_ethnicity || "",
        model_styling_notes: ov.model_styling_notes || "",
      };
    }
    timings.plan = Math.round(performance.now() - tPlan0);

    plan = applyFreeformOverrides(plan, {
      styleKeywords: styleKeywordsFinal.value ? parseLocalTags(styleKeywordsFinal.value) : undefined,
      accessories: activeConfig.value.accessories.trim() ? parseLocalTags(activeConfig.value.accessories) : undefined,
    });

    const chosenBg = getSelectedBackground(plan.background_theme);
    const chosenModel = getSelectedModel(plan.model_ethnicity);

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: geminiApiKey.value,
      model: "gemini-3-flash-preview",
      plan,
      background: chosenBg ? assetMetaFromLocal(chosenBg) : null,
      chosenModel: chosenModel ? assetMetaFromLocal(chosenModel) : null,
      hasBackgroundReference: Boolean(chosenBg),
      hasModelReference: Boolean(chosenModel),
      timeoutMs: 120_000,
    });
    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
    debug.final_prompt = finalPromptRes.prompt;

    generationStepIndex.value = 2;

	    const garmentRefPrompt = buildGarmentReferencePrompt();
	    const tGarment0 = performance.now();
	    const garmentRef = await generateImage({
	      apiKey: geminiApiKey.value,
	      model: "gemini-3-pro-image-preview",
	      promptText: garmentRefPrompt,
	      images: garmentInlines,
	      timeoutMs: 180_000,
	    });
    timings.garment_reference = Math.round(performance.now() - tGarment0);

    const garmentRefBytes = base64ToBytes(garmentRef.imageBase64);

    const compositeImages: Array<{ mimeType: string; data: Uint8Array }> = [
      { mimeType: garmentRef.mimeType, data: garmentRefBytes },
    ];
    let hasModelRef = false;
    let hasBgRef = false;
    if (chosenModel) {
      compositeImages.push(dataUrlToInlineImage(chosenModel.image_url));
      hasModelRef = true;
    }
    if (chosenBg) {
      compositeImages.push(dataUrlToInlineImage(chosenBg.image_url));
      hasBgRef = true;
    }

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference: hasModelRef,
      hasBackgroundReference: hasBgRef,
    });
    debug.composite_prompt = compositePrompt;
    debug.negative_prompt = plan.negative_prompt;

    generationStepIndex.value = 3;
    const tComposite0 = performance.now();
    const composite = await generateImage({
      apiKey: geminiApiKey.value,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: compositeImages,
      timeoutMs: 180_000,
    });
    timings.composite = Math.round(performance.now() - tComposite0);

    runtime.resultMimeType = composite.mimeType;
    runtime.resultDataUrl = `data:${composite.mimeType};base64,${composite.imageBase64}`;

    runtime.resultTimingsMs = {
      ...timings,
      api_total: Object.values(timings).reduce((a, b) => a + b, 0),
    };

    runtime.chosenSummary = {
      occasion: plan.occasion,
      color_scheme: plan.color_scheme,
      print_style: plan.print_style,
      style_keywords: plan.style_keywords,
      accessories: plan.accessories,
      background_theme: plan.background_theme,
      model_ethnicity: plan.model_ethnicity,
      background: {
        id: chosenBg?.id ?? null,
        title: chosenBg?.title ?? null,
        theme: chosenBg?.theme ?? null,
      },
      model: {
        id: chosenModel?.id ?? null,
        title: chosenModel?.title ?? null,
        ethnicity: chosenModel?.ethnicity ?? null,
      },
    };

    runtime.debugSummary = includeDebug.value
      ? {
          timings_ms: runtime.resultTimingsMs,
          plan_error: planError,
          ...debug,
        }
      : null;
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}

// Assets tab state
const bgFileInputRef = ref<HTMLInputElement | null>(null);
const modelFileInputRef = ref<HTMLInputElement | null>(null);

const bgFile = ref<File | null>(null);
const bgTitle = ref("");
const bgTheme = ref("");
const bgTags = ref("");
const bgUploadError = ref<string | null>(null);
const bgUploading = ref(false);

const modelFile = ref<File | null>(null);
const modelTitle = ref("");
const modelAssetEthnicity = ref("");
const modelTags = ref("");
const modelUploadError = ref<string | null>(null);
const modelUploading = ref(false);

function onBgFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  bgFile.value = input?.files?.[0] ?? null;
}

function onModelFileChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  modelFile.value = input?.files?.[0] ?? null;
}

async function uploadBackground() {
  bgUploadError.value = null;
  if (!bgFile.value) {
    bgUploadError.value = "Select an image.";
    return;
  }
  bgUploading.value = true;
  try {
    const dataUrl = await fileToDataUrl(bgFile.value);
    const asset: LocalAsset = {
      id: randomId(),
      title: (bgTitle.value.trim() || bgTheme.value.trim() || "Background").trim(),
      theme: bgTheme.value.trim() || null,
      ethnicity: null,
      tags: parseLocalTags(bgTags.value),
      image_url: dataUrl,
      mime_type: (bgFile.value.type || "image/*").split(";")[0].trim(),
      created_at: nowIso(),
    };
    await upsertAsset("background", asset);
    bgFile.value = null;
    if (bgFileInputRef.value) bgFileInputRef.value.value = "";
    bgTitle.value = "";
    bgTheme.value = "";
    bgTags.value = "";
    await refreshAssets();
  } catch (err: any) {
    bgUploadError.value = err?.message || String(err);
  } finally {
    bgUploading.value = false;
  }
}

async function uploadModel() {
  modelUploadError.value = null;
  if (!modelFile.value) {
    modelUploadError.value = "Select an image.";
    return;
  }
  modelUploading.value = true;
  try {
    const dataUrl = await fileToDataUrl(modelFile.value);
    const asset: LocalAsset = {
      id: randomId(),
      title: (modelTitle.value.trim() || modelAssetEthnicity.value.trim() || "Model").trim(),
      theme: null,
      ethnicity: modelAssetEthnicity.value.trim() || null,
      tags: parseLocalTags(modelTags.value),
      image_url: dataUrl,
      mime_type: (modelFile.value.type || "image/*").split(";")[0].trim(),
      created_at: nowIso(),
    };
    await upsertAsset("model", asset);
    modelFile.value = null;
    if (modelFileInputRef.value) modelFileInputRef.value.value = "";
    modelTitle.value = "";
    modelAssetEthnicity.value = "";
    modelTags.value = "";
    await refreshAssets();
  } catch (err: any) {
    modelUploadError.value = err?.message || String(err);
  } finally {
    modelUploading.value = false;
  }
}
</script>
