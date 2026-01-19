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

    <div>
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

      <div v-if="generateView !== 'library'" class="card storyboardEditorCard">
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

		        <div class="divider storyboardEditorDivider" aria-hidden="true"></div>

	        <div class="storyboardEditorCardBody">
	          <div class="grid storyBoard">
	            <form class="storyboardForm" @submit.prevent="onGenerateLook">
	              <fieldset class="formFieldset" :disabled="isGenerating">
	                <div class="storyboardCards">
	                  <div class="card">
	                    <div class="sectionTitle" style="margin-top: 0">Garment photos</div>
	                    <div>
	                      <FieldLabel
		              htmlFor="garmentPhoto"
		              label="Photos"
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
	              <div
	                v-for="(src, idx) in activeRuntime.garmentDataUrls"
	                :key="`${activeStoryboardId}-${idx}`"
	                class="previewItem"
	              >
	                <img :src="src" :alt="`Garment angle ${idx + 1}`" draggable="false" />
	                <button
	                  type="button"
	                  class="removePreviewButton"
	                  @click="removeGarmentImage(idx)"
	                  :aria-label="`Remove garment image ${idx + 1}`"
	                  title="Remove image"
	                >
	                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
	                    <path d="M18 6 6 18" />
	                    <path d="M6 6l12 12" />
	                  </svg>
	                </button>
	              </div>
	            </div>
	            <div v-if="activeRuntime.garmentDataUrls.length < 3" class="muted" style="margin-top: 8px">
	              Tip: upload 3–4 angles (front/side/back) for better accuracy.
	            </div>
	          </div>

	                  </div>

	                  <div class="card">
	                    <div class="sectionTitle" style="margin-top: 0">Creative Direction</div>

          <div>
            <FieldLabel
              label="Occasion"
              info="Sets the vibe for styling and scene (lighting, accessories, background mood). Pick a preset and optionally add extra detail (e.g., “sunset beach”, “nightclub”, “wedding guest”)."
            />
            <PillRadioGroup
              name="occasion"
              :model-value="activeConfig.occasionPreset"
              @update:model-value="activeConfig.occasionPreset = $event"
              :options="occasionPresetOptions"
            />
            <div style="height: 14px" />
            <input
              class="control"
              type="text"
              v-model="activeConfig.occasionDetails"
              placeholder="Optional: add details or type a custom occasion"
            />
          </div>

          <div style="height: 40px" />

          <div class="row">
            <div>
              <FieldLabel
                label="Color scheme"
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
                label="Accessories"
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

	          <div style="height: 40px" />

	          <div>
	            <FieldLabel
	              label="Footwear"
	              info="Choose footwear and optionally add details. If you set both, they will be combined."
	            />
	            <PillRadioGroup
	              name="footwear"
	              :model-value="activeConfig.footwearPreset"
	              @update:model-value="activeConfig.footwearPreset = $event"
	              :options="[
	                { value: '', label: 'Auto' },
	                { value: 'white_sneakers', label: 'White sneakers' },
	                { value: 'chunky_sneakers', label: 'Chunky sneakers' },
	                { value: 'strappy_heels', label: 'Strappy heels' },
	                { value: 'block_heels', label: 'Block heels' },
	                { value: 'minimal_sandals', label: 'Minimal sandals' },
	                { value: 'platform_sandals', label: 'Platform sandals' },
	                { value: 'ankle_boots', label: 'Ankle boots' },
	                { value: 'knee_boots', label: 'Knee-high boots' },
	                { value: 'ballet_flats', label: 'Ballet flats' },
	                { value: 'loafers', label: 'Loafers' },
	                { value: 'mules', label: 'Mules' },
	                { value: 'slides', label: 'Slides' },
	                { value: 'custom', label: 'Custom' },
	              ]"
	            />
	            <div style="height: 14px" />
	            <input
	              class="control"
	              type="text"
	              v-model="activeConfig.footwearDetails"
	              placeholder="Optional: add details (e.g., white sneakers, nude heels, leather boots)"
	            />
	          </div>

	          <div style="height: 40px" />

		          <div>
		            <FieldLabel
		              label="Overall Style"
		              info="Pick a modern ecommerce styling direction (e.g., quiet luxury, streetwear, athleisure). You can also add extra keywords below."
	            />
	            <PillRadioGroup
	              name="styleKeywords"
	              :model-value="activeConfig.stylePreset"
	              @update:model-value="activeConfig.stylePreset = $event"
		              :options="stylePresetOptions"
	            />
	            <div style="height: 14px" />
	            <input
	              class="control"
	              type="text"
	              v-model="activeConfig.styleKeywordsDetails"
	              placeholder="Optional: add style keywords (comma separated)"
	            />
	          </div>

	                  </div>

	                  <div class="card">
	                    <div class="sectionTitle" style="margin-top: 0">Background</div>

          <div>
            <FieldLabel
              label="Background theme"
              info="Describes the environment you want (e.g., studio, beach, rooftop, garden). Pick a preset and optionally add extra detail. If you select an uploaded background thumbnail below, that image will be used as the scene reference."
            />
	            <PillRadioGroup
	              name="backgroundTheme"
	              :model-value="activeConfig.backgroundThemePreset"
	              @update:model-value="activeConfig.backgroundThemePreset = $event"
	              :options="[
	                { value: '', label: 'Auto' },
                {
                  value:
                    'studio — bright modern ecommerce studio set; seamless backdrop or clean wall; soft diffused daylight; neutral tones; minimal props',
                  label: 'Studio',
                },
                {
                  value:
                    'beach — sunny coastal beach; clean sand; gentle waves; bright natural daylight; airy vacation vibe; uncluttered background',
                  label: 'Beach',
                },
	                {
	                  value:
	                    'sunset shoreline — golden hour beach at sunset; warm sky gradient; soft reflections; romantic coastal mood; clean framing',
	                  label: 'Sunset Shoreline',
	                },
	                {
	                  value:
	                    'arcade — modern neon-lit arcade; colorful ambient lights; glossy floor; playful nightlife energy; clean composition with soft bokeh',
	                  label: 'Arcade',
	                },
                {
                  value:
                    'upscale city street — modern storefronts; clean sidewalks; contemporary lifestyle vibe; soft daylight; minimal clutter; premium feel',
                  label: 'City',
                },
                {
                  value:
                    'rooftop terrace — modern rooftop with skyline; clean railings; golden-hour or soft daylight; premium lifestyle vibe; minimal clutter',
                  label: 'Rooftop',
                },
                {
                  value:
                    'coffee shop — modern cafe interior; warm daylight; clean tables; subtle background blur; trendy lifestyle vibe; uncluttered',
                  label: 'Coffee shop',
                },
                {
                  value:
                    'garden — lush landscaped garden; greenery; clean stone paths; soft natural light; elegant outdoor lifestyle; subtle bokeh',
                  label: 'Garden',
                },
                {
                  value:
                    'art gallery — minimal contemporary gallery; white walls; clean lines; soft even lighting; premium editorial vibe; uncluttered background',
                  label: 'Gallery',
                },
                {
                  value:
                    'minimal neutral interior — light textured wall; clean lines; neutral palette; uncluttered set; soft natural daylight; calm premium vibe',
                  label: 'Minimal',
                },
	                {
	                  value:
	                    'luxury hotel / penthouse — premium interior; marble/wood textures; tasteful decor; warm daylight; high-end lifestyle vibe; minimal clutter',
	                  label: 'Luxury',
	                },
	                {
	                  value:
	                    'mediterranean terrace — white stucco; stone tiles; olive trees; coastal Europe resort vibe; bright sun; airy open space; clean composition',
	                  label: 'Mediterranean Terrace',
	                },
	                {
	                  value:
	                    'concert venue — modern music venue; stage lights as soft bokeh; energetic atmosphere; keep product framing clean and readable, model should be standing in the crowd.',
	                  label: 'Concert',
	                },
	                {
	                  value:
	                    'nightclub lounge — upscale lounge; subtle neon accents; stylish nightlife vibe; moody but clean lighting; uncluttered background',
	                  label: 'Nightlife',
	                },
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

          <div style="height: 40px" />

	                  </div>

	                  <div class="card">
	                    <div class="sectionTitle" style="margin-top: 0">Model</div>

          <div>
            <FieldLabel
              label="Model"
              info="Use this to bias the generated model (ethnicity / vibe) when you are not selecting a specific model image. Pick a preset and/or add your own description."
            />
            <PillRadioGroup
              name="modelPreference"
              :model-value="activeConfig.modelPreset"
              @update:model-value="activeConfig.modelPreset = $event"
              :options="[
                { value: '', label: 'Auto' },
                { value: 'South Asian (Indian)', label: 'Indian' },
                { value: 'East Asian', label: 'East Asian' },
                { value: 'Black', label: 'Black' },
                { value: 'White / European', label: 'White / European' },
                { value: 'Middle Eastern', label: 'Middle Eastern' },
                { value: 'Latina', label: 'Latina' },
                { value: 'Mixed / Diverse', label: 'Mixed / Diverse' },
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

          <div style="height: 40px" />

          <div style="height: 40px" />

	          <div>
	            <div>
	              <FieldLabel
	                label="Model styling notes"
	                info="Pick a preset for hair/makeup/jewelry, and optionally add your own notes. If you set both, they will be combined."
	              />
	              <PillRadioGroup
	                name="modelStyling"
	                :model-value="activeConfig.modelStylingPreset"
	                @update:model-value="activeConfig.modelStylingPreset = $event"
	                :options="modelStylingPresetOptions"
	              />
	              <div style="height: 14px" />
	              <input
	                class="control"
	                type="text"
	                v-model="activeConfig.modelStylingNotes"
	                placeholder="Optional: add your own notes (hair/makeup/jewelry, vibe)"
	              />
	            </div>
	          </div>

	                  </div>

	                  <div class="card">
	                    <div class="sectionTitle" style="margin-top: 0">Generate</div>

	          <div class="actions">
	            <button type="submit" class="btnPrimary" :disabled="isGenerating">
	              {{ isGenerating ? "Generating..." : "Generate look" }}
	            </button>
	            <button
	              type="button"
	              class="btnGhost"
	              :aria-pressed="activeConfig.includeDebugStr === 'yes'"
	              :disabled="isGenerating"
	              @click="activeConfig.includeDebugStr = activeConfig.includeDebugStr === 'yes' ? 'no' : 'yes'"
	              title="Show/hide the internal prompts used for generation."
	            >
	              {{ activeConfig.includeDebugStr === "yes" ? "Debug off" : "Debug" }}
	            </button>
	          </div>

          <div v-if="activeRuntime.generateError" class="error">{{ activeRuntime.generateError }}</div>

          <div v-if="activeRuntime.chosenSummary" style="margin-top: 12px">
            <label>Chosen plan</label>
            <pre class="muted" style="white-space: pre-wrap">{{ JSON.stringify(activeRuntime.chosenSummary, null, 2) }}</pre>
          </div>

		          <div v-if="activeRuntime.debugSummary && activeConfig.includeDebugStr === 'yes'" style="margin-top: 12px">
		            <label>Prompts</label>
		            <div v-if="activeRuntime.debugSummary.final_prompt" style="margin-top: 10px">
		              <div class="muted" style="margin-bottom: 6px">Text prompt (LLM output)</div>
		              <pre class="muted" style="white-space: pre-wrap">{{ activeRuntime.debugSummary.final_prompt }}</pre>
		            </div>
		            <div v-if="activeRuntime.debugSummary.composite_prompt" style="margin-top: 10px">
		              <div class="muted" style="margin-bottom: 6px">Image prompt (composite)</div>
		              <pre class="muted" style="white-space: pre-wrap">{{ activeRuntime.debugSummary.composite_prompt }}</pre>
		            </div>
		            <div v-if="activeRuntime.debugSummary.negative_prompt" style="margin-top: 10px">
		              <div class="muted" style="margin-bottom: 6px">Avoid</div>
		              <pre class="muted" style="white-space: pre-wrap">{{ activeRuntime.debugSummary.negative_prompt }}</pre>
		            </div>
	                  </div>
	                  </div>
	                </div>
	              </fieldset>
	            </form>

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
            <div class="resultActionsRight">
              <div v-if="activeRuntime.resultTimingsMs" class="badge" title="Time spent generating this image">
                <span>Thinking</span>
                <code>{{ formatDurationMs(computedTimings.textLlmMs) }}</code>
                <span>Image gen</span>
                <code>{{ formatDurationMs(computedTimings.imageGenMs) }}</code>
                <span>Total</span>
                <code>{{ formatDurationMs(computedTimings.totalMs) }}</code>
              </div>
            </div>
          </div>
          <div
            class="resultImageZoom"
            @pointermove="onResultImagePointerMove"
            @pointerleave="onResultImagePointerLeave"
          >
            <img class="resultImage" :src="activeRuntime.resultDataUrl" alt="Generated look" draggable="false" />
          </div>
          <div class="resultImageButtons">
            <a
              class="btn btnGhost iconButton"
              style="width: 130px;"
              :href="activeRuntime.resultDataUrl"
              :download="`look-${Date.now()}.${mimeToExtension(activeRuntime.resultMimeType)}`"
              aria-label="Download generated image"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 3v10" />
                <path d="M8 11l4 4 4-4" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>&nbsp;&nbsp;Download
            </a>
            <button
              type="button"
              class="btnGhost iconButton"
              @click="openImageModal(activeRuntime.resultDataUrl, 'Generated look', 'Generated look')"
              aria-label="Open generated image"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M10 10 5 5" />
                <path d="M5 8V5H8" />
                <path d="M14 10 19 5" />
                <path d="M16 5h3v3" />
                <path d="M10 14 5 19" />
                <path d="M5 16v3h3" />
                <path d="M14 14 19 19" />
                <path d="M16 19h3v-3" />
              </svg>
            </button>
          </div>
        </template>

	        <div v-else class="resultPlaceholder resultEmpty">
	          <div>
	            <div class="resultEmptyTitle">Ready when you are</div>
	            <div class="muted">Upload garment photos, then click “Generate look”.</div>
	          </div>
	        </div>

	        <div class="divider" style="margin: 18px 0" />

	        <FieldLabel
	          label="Multiple Angles"
	          info="Generate natural ecommerce poses for side and back views, matching the same garment + model + scene as the main result."
	        />

	        <div v-if="!activeRuntime.resultDataUrl" class="muted">
	          Generate the main image first to unlock multiple angles.
	        </div>

	        <div v-else>
	          <div class="actions" style="justify-content: space-between">
	            <button
	              type="button"
	              class="btnSecondary"
	              @click="generateMultipleAngles"
	              :disabled="isGenerating || activeRuntime.angles.generating"
	            >
	              {{ activeRuntime.angles.generating ? "Generating..." : "Generate Multiple Angles" }}
	            </button>
	            <button
	              v-if="activeRuntime.angles.sideDataUrl && activeRuntime.angles.backDataUrl"
	              type="button"
	              class="btnPrimary"
	              @click="downloadAllImages"
	            >
	              Download all images
	            </button>
	          </div>

	          <div v-if="activeRuntime.angles.timingsMs" class="muted" style="margin-top: 10px">
	            Side: {{ formatDurationMs(activeRuntime.angles.timingsMs.side) }} · Back:
	            {{ formatDurationMs(activeRuntime.angles.timingsMs.back) }} · Total:
	            {{ formatDurationMs(activeRuntime.angles.timingsMs.total) }}
	          </div>

	          <div v-if="activeRuntime.angles.error" class="error">{{ activeRuntime.angles.error }}</div>

	          <div v-if="activeRuntime.angles.sideDataUrl || activeRuntime.angles.backDataUrl" class="anglesGrid">
	            <div class="angleTile">
	              <div class="angleTileHeader">
	                <div class="angleTileTitle">Side view</div>
	                <div v-if="activeRuntime.angles.sideDataUrl" class="angleTileActions">
	                  <button
	                    type="button"
	                    class="btnGhost iconButton"
	                    @click="openImageModal(activeRuntime.angles.sideDataUrl, 'Side view', 'Generated side view')"
	                    aria-label="Open side view"
	                  >
	                    <svg
	                      viewBox="0 0 24 24"
	                      fill="none"
	                      stroke="currentColor"
	                      stroke-width="2"
	                      stroke-linecap="round"
	                      stroke-linejoin="round"
	                      aria-hidden="true"
	                      focusable="false"
	                    >
	                      <path d="M10 10 5 5" />
	                      <path d="M5 8V5H8" />
	                      <path d="M14 10 19 5" />
	                      <path d="M16 5h3v3" />
	                      <path d="M10 14 5 19" />
	                      <path d="M5 16v3h3" />
	                      <path d="M14 14 19 19" />
	                      <path d="M16 19h3v-3" />
	                    </svg>
	                  </button>
	                  <a
	                    class="btn btnGhost iconButton"
	                    :href="activeRuntime.angles.sideDataUrl"
	                    :download="`look-side-${Date.now()}.${mimeToExtension(activeRuntime.angles.sideMimeType)}`"
	                    aria-label="Download side view"
	                  >
	                    <svg
	                      viewBox="0 0 24 24"
	                      fill="none"
	                      stroke="currentColor"
	                      stroke-width="2"
	                      stroke-linecap="round"
	                      stroke-linejoin="round"
	                      aria-hidden="true"
	                      focusable="false"
	                    >
	                      <path d="M12 3v10" />
	                      <path d="M8 11l4 4 4-4" />
	                      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
	                    </svg>
	                  </a>
	                </div>
	              </div>
	              <div v-if="activeRuntime.angles.sideDataUrl" style="margin-top: 10px">
	                <img :src="activeRuntime.angles.sideDataUrl" alt="Generated side view" draggable="false" />
	              </div>
	              <div v-else class="muted" style="margin-top: 10px">Not generated yet.</div>
	            </div>

	            <div class="angleTile">
	              <div class="angleTileHeader">
	                <div class="angleTileTitle">Back view</div>
	                <div v-if="activeRuntime.angles.backDataUrl" class="angleTileActions">
	                  <button
	                    type="button"
	                    class="btnGhost iconButton"
	                    @click="openImageModal(activeRuntime.angles.backDataUrl, 'Back view', 'Generated back view')"
	                    aria-label="Open back view"
	                  >
	                    <svg
	                      viewBox="0 0 24 24"
	                      fill="none"
	                      stroke="currentColor"
	                      stroke-width="2"
	                      stroke-linecap="round"
	                      stroke-linejoin="round"
	                      aria-hidden="true"
	                      focusable="false"
	                    >
	                      <path d="M10 10 5 5" />
	                      <path d="M5 8V5H8" />
	                      <path d="M14 10 19 5" />
	                      <path d="M16 5h3v3" />
	                      <path d="M10 14 5 19" />
	                      <path d="M5 16v3h3" />
	                      <path d="M14 14 19 19" />
	                      <path d="M16 19h3v-3" />
	                    </svg>
	                  </button>
	                  <a
	                    class="btn btnGhost iconButton"
	                    :href="activeRuntime.angles.backDataUrl"
	                    :download="`look-back-${Date.now()}.${mimeToExtension(activeRuntime.angles.backMimeType)}`"
	                    aria-label="Download back view"
	                  >
	                    <svg
	                      viewBox="0 0 24 24"
	                      fill="none"
	                      stroke="currentColor"
	                      stroke-width="2"
	                      stroke-linecap="round"
	                      stroke-linejoin="round"
	                      aria-hidden="true"
	                      focusable="false"
	                    >
	                      <path d="M12 3v10" />
	                      <path d="M8 11l4 4 4-4" />
	                      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
	                    </svg>
	                  </a>
	                </div>
	              </div>
	              <div v-if="activeRuntime.angles.backDataUrl" style="margin-top: 10px">
	                <img :src="activeRuntime.angles.backDataUrl" alt="Generated back view" draggable="false" />
	              </div>
	              <div v-else class="muted" style="margin-top: 10px">Not generated yet.</div>
	            </div>
	          </div>
	        </div>
      </div>
	          </div>
	        </div>
	    </div>
    </div>

	    <div
	      v-if="imageModal"
	      class="modalOverlay"
	      role="dialog"
	      aria-modal="true"
	      :aria-label="imageModal.title"
	      @click.self="closeImageModal"
	    >
	      <div class="modalCard imageModalCard">
	        <div class="imageModalHeader">
	          <div class="modalTitle">{{ imageModal.title }}</div>
	          <button type="button" class="btnGhost iconButton" @click="closeImageModal" aria-label="Close image">
	            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
	              <path d="M18 6 6 18" />
	              <path d="M6 6l12 12" />
	            </svg>
	          </button>
	        </div>
	        <div class="imageModalBody">
	          <img :src="imageModal.src" :alt="imageModal.alt" draggable="false" />
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
	          This removes <strong>{{ activeStoryboard.title }}</strong> from this browser.
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
import { fileToDataUrl, nowIso, parseTags as parseLocalTags, randomId } from "./lib/utils";
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
	  buildMultiAnglePrompt,
	  computeTimingsMs,
	  generateFinalPrompt,
	  planLookFromGarment,
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

		type StoryboardAnglesRuntime = {
		  generating: boolean;
		  error: string | null;
		  sideDataUrl: string | null;
		  sideMimeType: string | null;
		  backDataUrl: string | null;
		  backMimeType: string | null;
		  timingsMs: { side: number; back: number; total: number } | null;
		};

		type StoryboardRuntime = {
		  garmentDataUrls: string[];
		  garmentFileNames: string[];
		  garmentRefDataUrl: string | null;
		  garmentRefMimeType: string | null;
		  lastPlan: LookPlan | null;
		  lastFinalPrompt: string | null;
		  angles: StoryboardAnglesRuntime;
		  generateError: string | null;
		  chosenSummary: any;
		  debugSummary: any;
		  resultDataUrl: string | null;
		  resultMimeType: string | null;
		  resultTimingsMs: Record<string, number> | null;
		};

		function createDefaultAnglesRuntime(): StoryboardAnglesRuntime {
		  return {
		    generating: false,
		    error: null,
		    sideDataUrl: null,
		    sideMimeType: null,
		    backDataUrl: null,
		    backMimeType: null,
		    timingsMs: null,
		  };
		}

		function createDefaultRuntime(): StoryboardRuntime {
		  return {
		    garmentDataUrls: [],
		    garmentFileNames: [],
		    garmentRefDataUrl: null,
		    garmentRefMimeType: null,
		    lastPlan: null,
		    lastFinalPrompt: null,
		    angles: createDefaultAnglesRuntime(),
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
type ImageModalState = { src: string; title: string; alt: string };
const imageModal = ref<ImageModalState | null>(null);

function openImageModal(src: string | null | undefined, title: string, alt?: string) {
  if (!src) return;
  imageModal.value = { src, title, alt: alt ?? title };
}

function closeImageModal() {
  imageModal.value = null;
}

function onGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" && imageModal.value) closeImageModal();
}

function removeGarmentImage(index: number) {
  const runtime = activeRuntime.value;
  if (!runtime.garmentDataUrls.length) return;
  if (index < 0 || index >= runtime.garmentDataUrls.length) return;
  runtime.garmentDataUrls.splice(index, 1);
  runtime.garmentFileNames.splice(index, 1);
}

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

		  const occasionPresetLabel =
		    cfg.occasionPreset && cfg.occasionPreset !== "custom"
		      ? occasionPresetLabelByValue[cfg.occasionPreset] ?? cfg.occasionPreset
		      : "";
		  const occasion =
		    cfg.occasionPreset === "custom"
		      ? cfg.occasionDetails.trim()
		      : combinePresetAndCustom({ presetText: occasionPresetLabel, customText: cfg.occasionDetails, joiner: ", " });
		  if (occasion) parts.push(`Occasion: ${occasion}`);

	  const color = cfg.colorScheme.trim();
	  if (color) parts.push(`Colors: ${color}`);

	  const stylePresetText =
	    cfg.stylePreset && cfg.stylePreset !== "custom"
	      ? stylePresetLabelByValue[cfg.stylePreset] ?? cfg.stylePreset
	      : "";
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

		  const accessories = cfg.accessories.trim();
		  if (accessories) parts.push(`Accessories: ${accessories}`);

			  const footwearPresetLabel =
			    cfg.footwearPreset && cfg.footwearPreset !== "custom"
			      ? footwearPresetLabels[cfg.footwearPreset] ?? cfg.footwearPreset
			      : "";
			  const footwear =
			    cfg.footwearPreset === "custom"
			      ? cfg.footwearDetails.trim()
			      : combinePresetAndCustom({
			          presetText: footwearPresetLabel,
			          customText: cfg.footwearDetails,
			          joiner: ", ",
			        });
			  if (footwear) parts.push(`Footwear: ${footwear}`);

	  const ethnicity =
	    cfg.modelPreset === "custom"
	      ? cfg.modelDetails.trim()
	      : combinePresetAndCustom({ presetText: cfg.modelPreset, customText: cfg.modelDetails, joiner: ", " });
	  if (ethnicity) parts.push(`Model: ${ethnicity}`);

		  const stylingPresetText =
		    cfg.modelStylingPreset && cfg.modelStylingPreset !== "custom"
		      ? modelStylingPresetLabelByValue[cfg.modelStylingPreset] ?? cfg.modelStylingPreset
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
		    garmentRefDataUrl: activeRuntime.value.garmentRefDataUrl,
		    garmentRefMimeType: activeRuntime.value.garmentRefMimeType,
		    lastPlan: activeRuntime.value.lastPlan ? safeClone(activeRuntime.value.lastPlan) : null,
		    lastFinalPrompt: activeRuntime.value.lastFinalPrompt,
		    angles: {
		      ...createDefaultAnglesRuntime(),
		      sideDataUrl: activeRuntime.value.angles.sideDataUrl,
		      sideMimeType: activeRuntime.value.angles.sideMimeType,
		      backDataUrl: activeRuntime.value.angles.backDataUrl,
		      backMimeType: activeRuntime.value.angles.backMimeType,
		      timingsMs: activeRuntime.value.angles.timingsMs ? { ...activeRuntime.value.angles.timingsMs } : null,
		    },
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
	    if (input) input.value = "";
	    return;
	  }

	  const MAX = 4;
	  const remaining = Math.max(0, MAX - runtime.garmentDataUrls.length);
	  if (!remaining) {
	    runtime.generateError = "You can upload up to 4 garment photos. Remove one to add more.";
	    if (input) input.value = "";
	    return;
	  }

	  const limited = files.slice(0, remaining);
	  const dataUrls = await Promise.all(limited.map((f) => fileToDataUrl(f)));
	  runtime.garmentFileNames.push(...limited.map((f) => f.name || "garment"));
	  runtime.garmentDataUrls.push(...dataUrls);

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
  window.removeEventListener("keydown", onGlobalKeyDown);
});

function clearResult() {
  const runtime = activeRuntime.value;
  runtime.resultDataUrl = null;
  runtime.resultMimeType = null;
  runtime.garmentRefDataUrl = null;
  runtime.garmentRefMimeType = null;
  runtime.lastPlan = null;
  runtime.lastFinalPrompt = null;
  runtime.angles = createDefaultAnglesRuntime();
  runtime.chosenSummary = null;
  runtime.debugSummary = null;
  runtime.resultTimingsMs = null;
  runtime.generateError = null;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadAllImages() {
  const runtime = activeRuntime.value;
  if (!runtime.resultDataUrl) return;
  if (!runtime.angles.sideDataUrl || !runtime.angles.backDataUrl) return;

  const ts = Date.now();
  triggerDownload(runtime.resultDataUrl, `look-main-${ts}.${mimeToExtension(runtime.resultMimeType)}`);
  triggerDownload(runtime.angles.sideDataUrl, `look-side-${ts}.${mimeToExtension(runtime.angles.sideMimeType)}`);
  triggerDownload(runtime.angles.backDataUrl, `look-back-${ts}.${mimeToExtension(runtime.angles.backMimeType)}`);
}

async function generateMultipleAngles() {
  const runtime = activeRuntime.value;
  if (isGenerating.value) return;
  if (runtime.angles.generating) return;

  runtime.angles.error = null;

  const apiKey = geminiApiKey.value.trim();
  if (!apiKey) {
    runtime.angles.error = "Please paste your API key (BYO key).";
    return;
  }
  if (!runtime.resultDataUrl) {
    runtime.angles.error = "Generate the main image first.";
    return;
  }
  if (!runtime.garmentRefDataUrl) {
    runtime.angles.error = "Missing garment reference. Please generate the main image again.";
    return;
  }
  if (!runtime.lastPlan) {
    runtime.angles.error = "Missing generation context. Please generate the main image again.";
    return;
  }

  runtime.angles.generating = true;
  runtime.angles.sideDataUrl = null;
  runtime.angles.sideMimeType = null;
  runtime.angles.backDataUrl = null;
  runtime.angles.backMimeType = null;
  runtime.angles.timingsMs = null;

  try {
    const garmentRefInline = dataUrlToInlineImage(runtime.garmentRefDataUrl);
    const garmentAnglesInline = runtime.garmentDataUrls.map((src) => dataUrlToInlineImage(src));
    const mainInline = dataUrlToInlineImage(runtime.resultDataUrl);

    const referenceImages = [garmentRefInline, ...garmentAnglesInline, mainInline];

    const promptBase = {
      plan: runtime.lastPlan,
      finalPrompt: runtime.lastFinalPrompt || "",
      garmentAngleCount: garmentAnglesInline.length,
      hasModelReference: false,
      hasBackgroundReference: false,
    } as const;

    const sidePrompt = buildMultiAnglePrompt({ ...promptBase, angle: "side" });
    const backPrompt = buildMultiAnglePrompt({ ...promptBase, angle: "back" });

    const t0 = performance.now();
    const [sideRes, backRes] = await Promise.all([
      (async () => {
        const t = performance.now();
	        const res = await generateImage({
	          apiKey,
	          model: "gemini-3-pro-image-preview",
	          promptText: sidePrompt,
	          images: referenceImages,
	          aspectRatio: "3:4",
	          width: 1080,
	          height: 1440,
	          timeoutMs: 180_000,
	        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
      (async () => {
        const t = performance.now();
	        const res = await generateImage({
	          apiKey,
	          model: "gemini-3-pro-image-preview",
	          promptText: backPrompt,
	          images: referenceImages,
	          aspectRatio: "3:4",
	          width: 1080,
	          height: 1440,
	          timeoutMs: 180_000,
	        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
    ]);

    runtime.angles.sideMimeType = sideRes.res.mimeType;
    runtime.angles.sideDataUrl = `data:${sideRes.res.mimeType};base64,${sideRes.res.imageBase64}`;
    runtime.angles.backMimeType = backRes.res.mimeType;
    runtime.angles.backDataUrl = `data:${backRes.res.mimeType};base64,${backRes.res.imageBase64}`;
    runtime.angles.timingsMs = {
      side: sideRes.ms,
      back: backRes.ms,
      total: Math.round(performance.now() - t0),
    };
  } catch (err: any) {
    runtime.angles.error = err?.message || String(err);
  } finally {
    runtime.angles.generating = false;
  }
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

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeyDown);
});

// Derived inputs
const occasionPresetOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto" },
  {
    value:
      "everyday casual daytime street style; modern ecommerce look; clean natural daylight; approachable, effortless vibe",
    label: "Everyday",
  },
  {
    value:
      "weekend brunch daytime; trendy polished casual; bright natural light; relaxed upscale vibe; clean composition",
    label: "Brunch",
  },
  {
    value:
      "date night evening; chic elevated styling; flattering silhouette; warm cinematic lighting; premium nightlife mood",
    label: "Date night",
  },
  {
    value:
      "night out nightlife; bold trendy going-out look; city lights or neon bokeh; confident, fashion-forward vibe",
    label: "Night out",
  },
  {
    value:
      "music festival outdoors; youthful playful energy; street-style vibe; sunlit daytime; fun accessories, not cluttered",
    label: "Festival",
  },
  {
    value:
      "vacation / resort lifestyle; breezy sun-kissed look; relaxed luxury; airy atmosphere; bright natural light",
    label: "Vacation / Resort",
  },
  {
    value:
      "beachwear coastal; sunny seaside environment; clean sand and gentle water; airy warm-weather vibe; uncluttered",
    label: "Beachwear",
  },
  {
    value:
      "modern workwear; office-ready smart casual; polished and professional; clean interior; soft diffused daylight",
    label: "Work / Office",
  },
  { value: "custom", label: "Custom" },
];

const occasionPresetLabelByValue: Record<string, string> = Object.fromEntries(
  occasionPresetOptions
    .filter((o) => o.value && o.value !== "custom")
    .map((o) => [o.value, o.label]),
);

const occasionFinal = computed(() =>
  activeConfig.value.occasionPreset === "custom"
    ? activeConfig.value.occasionDetails.trim()
    : combinePresetAndCustom({
        presetText: activeConfig.value.occasionPreset,
        customText: activeConfig.value.occasionDetails,
        joiner: ", ",
      }),
);

const footwearPresetLabels: Record<string, string> = {
  white_sneakers: "White sneakers",
  chunky_sneakers: "Chunky sneakers",
  strappy_heels: "Strappy heels",
  block_heels: "Block heels",
  minimal_sandals: "Minimal sandals",
  platform_sandals: "Platform sandals",
  ankle_boots: "Ankle boots",
  knee_boots: "Knee-high boots",
  ballet_flats: "Ballet flats",
  loafers: "Loafers",
  mules: "Mules",
  slides: "Slides",
};

const footwearPresetKeywords: Record<string, string> = {
  white_sneakers: "clean white sneakers, modern, minimal, ecommerce-friendly",
  chunky_sneakers: "chunky sneakers, trendy, streetwear-leaning, modern",
  strappy_heels: "strappy heels, sleek, going-out, elegant",
  block_heels: "block heels, comfortable, modern, polished",
  minimal_sandals: "minimal sandals, neutral, clean, warm-weather",
  platform_sandals: "platform sandals, trendy, bold, fashion-forward",
  ankle_boots: "ankle boots, modern, sleek, versatile",
  knee_boots: "knee-high boots, statement, sleek, fashion-forward",
  ballet_flats: "ballet flats, feminine, classic, minimal",
  loafers: "loafers, smart casual, modern, polished",
  mules: "mules, chic, minimal, elevated casual",
  slides: "slides, casual, modern, warm-weather",
};

const footwearFinal = computed(() =>
  activeConfig.value.footwearPreset === "custom"
    ? activeConfig.value.footwearDetails.trim()
    : combinePresetAndCustom({
        presetText: footwearPresetKeywords[activeConfig.value.footwearPreset] ?? activeConfig.value.footwearPreset,
        customText: activeConfig.value.footwearDetails,
        joiner: ", ",
      }),
);

const stylePresetOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto" },
  {
    value:
      "minimal clean modern styling; premium basics; crisp lines; neutral palette; no loud logos; ecommerce lookbook vibe",
    label: "Minimal / Clean",
  },
  {
    value:
      "quiet luxury; understated tailoring; premium fabrics; refined proportions; neutral/earth tones; no flashy branding",
    label: "Quiet luxury",
  },
  {
    value:
      "classic timeless styling; wardrobe staples; polished and modern; clean lines; subtle elegance; premium feel",
    label: "Classic / Timeless",
  },
  {
    value:
      "contemporary streetwear; urban modern; relaxed silhouette; trendy styling; bold but clean; ecommerce editorial vibe",
    label: "Streetwear",
  },
  {
    value:
      "boho relaxed airy styling; earthy textures; soft movement; natural materials; effortless, sunlit lifestyle vibe",
    label: "Boho",
  },
  {
    value:
      "romantic feminine styling; soft delicate details; graceful silhouette; flattering look; light airy mood; tasteful",
    label: "Romantic / Feminine",
  },
  {
    value:
      "vintage / Y2K inspired; playful nostalgic energy; early-2000s vibe; trendy styling; clean modern execution",
    label: "Vintage / Y2K",
  },
  {
    value:
      "coastal resort lifestyle; breezy sun-kissed styling; linen textures; relaxed luxury; Mediterranean vacation vibe",
    label: "Coastal / Resort",
  },
  {
    value:
      "edgy bold styling; high-contrast palette; confident modern vibe; statement accessories (minimal count); clean framing",
    label: "Edgy / Bold",
  },
  { value: "custom", label: "Custom" },
];

const stylePresetLabelByValue: Record<string, string> = Object.fromEntries(
  stylePresetOptions
    .filter((o) => o.value && o.value !== "custom")
    .map((o) => [o.value, o.label]),
);

const stylePresetText = computed(() =>
  activeConfig.value.stylePreset && activeConfig.value.stylePreset !== "custom"
    ? activeConfig.value.stylePreset
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

const modelStylingPresetOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto" },
  {
    value:
      "natural glam makeup; fresh dewy skin; softly defined eyes; subtle lip; polished but effortless; ecommerce-friendly",
    label: "Natural glam",
  },
  {
    value:
      "soft glam; slightly more defined eye makeup; luminous skin; refined look; editorial but wearable; premium finish",
    label: "Soft glam",
  },
  {
    value:
      "minimal jewelry; small hoops or studs; delicate necklace; understated accessories; premium, clean styling",
    label: "Minimal jewelry",
  },
  {
    value: "hair up; clean bun or sleek ponytail; tidy flyaways; modern polished styling; premium look",
    label: "Hair up",
  },
  {
    value: "sleek hair; straight or slicked-back; glossy finish; modern editorial styling; premium feel",
    label: "Sleek",
  },
  {
    value:
      "beachy styling; loose natural waves; sun-kissed vibe; natural makeup; minimal jewelry; airy warm-weather mood",
    label: "Beachy",
  },
  { value: "custom", label: "Custom" },
];

const modelStylingPresetLabelByValue: Record<string, string> = Object.fromEntries(
  modelStylingPresetOptions
    .filter((o) => o.value && o.value !== "custom")
    .map((o) => [o.value, o.label]),
);

	const modelStylingPresetText = computed(() =>
	  activeConfig.value.modelStylingPreset && activeConfig.value.modelStylingPreset !== "custom"
	    ? activeConfig.value.modelStylingPreset
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
  runtime.garmentRefDataUrl = null;
  runtime.garmentRefMimeType = null;
  runtime.lastPlan = null;
  runtime.lastFinalPrompt = null;
  runtime.angles = createDefaultAnglesRuntime();
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
		      runtime.generateError = "Please select garment photos.";
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

    const availableThemes: string[] = [];
    const availableEthnicities: string[] = [];

    generationStepIndex.value = 1;

		    const userOverrides = {
		      occasion: occasionFinal.value || null,
		      color_scheme: activeConfig.value.colorScheme.trim() || null,
		      background_theme: backgroundThemeFinal.value || null,
		      footwear: footwearFinal.value || null,
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
	        footwear: ov.footwear || "",
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
	      footwear: footwearFinal.value || null,
	    });

	    runtime.lastPlan = safeClone(plan);

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: geminiApiKey.value,
      model: "gemini-3-flash-preview",
      plan,
      background: null,
      chosenModel: null,
      hasBackgroundReference: false,
      hasModelReference: false,
      timeoutMs: 120_000,
    });
	    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
	    debug.final_prompt = finalPromptRes.prompt;
	    runtime.lastFinalPrompt = finalPromptRes.prompt;

    generationStepIndex.value = 2;

	    const garmentRefPrompt = buildGarmentReferencePrompt();
	    const tGarment0 = performance.now();
		    const garmentRef = await generateImage({
		      apiKey: geminiApiKey.value,
		      model: "gemini-3-pro-image-preview",
		      promptText: garmentRefPrompt,
		      images: garmentInlines,
		      aspectRatio: "3:4",
		      width: 1080,
		      height: 1440,
		      timeoutMs: 180_000,
		    });
	    timings.garment_reference = Math.round(performance.now() - tGarment0);
	    runtime.garmentRefMimeType = garmentRef.mimeType;
	    runtime.garmentRefDataUrl = `data:${garmentRef.mimeType};base64,${garmentRef.imageBase64}`;

	    const garmentRefBytes = base64ToBytes(garmentRef.imageBase64);

    const compositeImages: Array<{ mimeType: string; data: Uint8Array }> = [
      { mimeType: garmentRef.mimeType, data: garmentRefBytes },
    ];

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference: false,
      hasBackgroundReference: false,
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
	      aspectRatio: "3:4",
	      width: 1080,
	      height: 1440,
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
	      footwear: plan.footwear,
	      accessories: plan.accessories,
	      background_theme: plan.background_theme,
	      model_ethnicity: plan.model_ethnicity,
	    };

	    runtime.debugSummary = {
	      timings_ms: runtime.resultTimingsMs,
	      plan_error: planError,
	      ...debug,
	    };
  } catch (err: any) {
    runtime.generateError = err?.message || String(err);
  } finally {
    isGenerating.value = false;
    stopGenerationTimer();
    generationStepIndex.value = 0;
  }
}
</script>
