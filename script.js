// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elements ---
    // Get references to various HTML elements by their IDs to interact with them
    const soundboardContainer = document.getElementById('soundboard-container');
    const searchInput = document.getElementById('search-input');
    const stopAllButton = document.getElementById('stop-all-button');
    const audioStatusDiv = document.getElementById('audio-status');
    const uploadSoundButton = document.getElementById('upload-sound-button');
    const uploadSoundInput = document.getElementById('upload-sound-input'); // The hidden file input
    const editModeButton = document.getElementById('edit-mode-button');
    const manageCategoriesButton = document.getElementById('manage-categories-button');
    const categoryFilterDropdown = document.getElementById('category-filter-dropdown');
    const sortByDropdown = document.getElementById('sort-by-dropdown');
    
    // Edit Sound Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editModalTitle = document.getElementById('edit-modal-title');
    const editSoundIdInput = document.getElementById('edit-sound-id'); // Hidden input for sound ID
    const editSoundNameInput = document.getElementById('edit-sound-name');
    const editSoundColorSelect = document.getElementById('edit-sound-color');
    const editSoundCategorySelect = document.getElementById('edit-sound-category');
    const editNewCategoryNameInput = document.getElementById('edit-new-category-name'); // For typing a new category
    const saveEditButton = document.getElementById('save-edit-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    
    // Manage Categories Modal Elements
    const manageCategoriesModal = document.getElementById('manage-categories-modal');
    const categoryListUl = document.getElementById('category-list'); // <ul> for listing categories
    const newCategoryInputName = document.getElementById('new-category-input-name'); // Input for new category name
    const addCategoryButton = document.getElementById('add-category-button');
    const closeManageCategoriesButton = document.getElementById('close-manage-categories-button');

    // --- State Variables ---
    // These variables hold the current state of the application
    let audioInitialized = false; // Flag to track if Tone.js audio context is started
    let players = null;           // Main Tone.Players object for initial, pre-defined sounds
    let isEditMode = false;       // Flag to track if edit mode is active
    let soundsData = [];          // Array to store all sound objects and their metadata
                                  // Each object: {id, name, originalName, filePath, color, category, player (for pre-defined), isUploaded, uploadedPlayer (for uploads), isLoading, hasError}
    let categories = [{ id: 'uncategorized', name: 'Uncategorized', isDeletable: false, isEditable: false }]; // Default category; not deletable or editable
    
    // Available colors for sound buttons, used in a cycle
    const availableButtonColors = ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'indigo', 'teal', 'orange', 'lime', 'cyan', 'gray'];
    
    // Populate the color dropdown in the "Edit Sound" modal with available colors
    availableButtonColors.forEach(color => {
        const option = document.createElement('option');
        option.value = color;
        option.textContent = color.charAt(0).toUpperCase() + color.slice(1); // Capitalize first letter
        editSoundColorSelect.appendChild(option);
    });

    // --- INITIAL SOUNDS CONFIGURATION ---
    // Instead of a hardcoded list, fetch the manifest
    let initialSoundFiles = [];

    async function fetchSoundManifest() {
        try {
            const response = await fetch('sounds/sounds.json');
            if (!response.ok) throw new Error('Failed to fetch sounds.json');
            initialSoundFiles = await response.json();
        } catch (e) {
            console.error('Error loading sounds manifest:', e);
            initialSoundFiles = [];
        }
    }

    // --- CORE FUNCTIONS ---

    /**
     * Generates a unique ID string.
     * @returns {string} A unique ID.
     */
    function generateUniqueId() { 
        return Date.now().toString(36) + Math.random().toString(36).substring(2); 
    }
    
    /**
     * Initializes the `soundsData` array from the `initialSoundFiles` list.
     * Each sound is given a unique ID, display name, color, and default category.
     */
    function initializeSoundsData() {
        let colorIndex = 0; // Used to cycle through availableButtonColors
        soundsData = initialSoundFiles.map(fileName => {
            // Create a more user-friendly display name from the filename
            let displayName = fileName.replace(/\.ogg$/i, ''); // Remove .ogg extension (case-insensitive)
            if (displayName.startsWith('--')) displayName = displayName.substring(2); // Remove leading '--' if present
            displayName = displayName.replace(/[-_]/g, ' '); // Replace hyphens and underscores with spaces
            displayName = displayName.replace(/\b\w/g, char => char.toUpperCase()); // Capitalize the first letter of each word

            // Construct the sound object
            return {
                id: generateUniqueId(), 
                name: displayName, 
                originalName: fileName, // Keep the original filename for reference
                filePath: `sounds/${fileName}`, // Assumes files are in a 'sounds' folder
                color: availableButtonColors[colorIndex++ % availableButtonColors.length], // Cycle through colors
                category: 'uncategorized', // Default category ID
                isUploaded: false, // Flag for sounds uploaded by the user vs. pre-defined
                player: null,      // Tone.Player instance for pre-defined sounds (loaded later)
                isLoading: false,  // Flag for tracking loading state
                hasError: false    // Flag for tracking loading errors
            };
        });
        console.log("Initial soundsData created (sample of first 3):", soundsData.slice(0,3));
        populateCategoryDropdowns(); // Update UI dropdowns with categories
        renderCategoryList(); // Update the list in the "Manage Categories" modal
    }

    /**
     * Initializes Tone.js audio context. 
     * Browsers often require user interaction (a click) to start audio.
     * This function sets up listeners for the first click/tap to start Tone.js.
     */
    async function initializeAudio() {
        if (Tone.context.state !== 'running') { // Check if audio context is not already running
            audioStatusDiv.textContent = 'Click anywhere or a button to enable audio.'; // Prompt user
            
            // Function to handle the first user gesture (click/tap)
            const startAudioOnGesture = async () => {
                if (Tone.context.state !== 'running') { // Double-check to prevent multiple starts
                    try {
                        await Tone.start(); // Start Tone.js audio context
                        console.log('AudioContext started via user gesture!');
                        audioInitialized = true;
                        audioStatusDiv.textContent = 'Audio active. Loading sounds...';
                        loadAndRenderSounds(); // Proceed to load sounds
                    } catch (e) {
                        console.error("Error starting AudioContext on gesture:", e);
                        audioStatusDiv.textContent = 'Failed to start audio. Please try again.';
                    } finally {
                        // Clean up event listeners once audio is started or an attempt has been made
                        document.body.removeEventListener('click', startAudioOnGesture, true);
                        document.body.removeEventListener('touchstart', startAudioOnGesture, true);
                    }
                }
            };
            // Add event listeners for the first click or touch interaction
            document.body.addEventListener('click', startAudioOnGesture, { once: true, capture: true });
            document.body.addEventListener('touchstart', startAudioOnGesture, { once: true, capture: true });
        } else { // Audio context is already running
            audioInitialized = true;
            audioStatusDiv.textContent = 'Audio active. Loading sounds...';
            loadAndRenderSounds(); // Proceed to load sounds
        }
    }
    
    /**
     * Renders the sound buttons in the soundboard container.
     * It uses the filtered and sorted list of sounds.
     * @param {Array} [sourceSounds=soundsData] - The array of sound objects to render. Defaults to all sounds.
     */
    function renderButtons(sourceSounds = soundsData) {
        soundboardContainer.innerHTML = ''; // Clear existing buttons
        const soundsToDisplay = getFilteredAndSortedSounds(sourceSounds); // Get the currently filtered/sorted list

        if (!soundsToDisplay || soundsToDisplay.length === 0) {
            // Display a message if no sounds match the current filter/search
            soundboardContainer.innerHTML = '<p class="text-gray-400 col-span-full text-center">No sounds to display for current filter.</p>';
            return;
        }

        // Create and append a button for each sound
        soundsToDisplay.forEach(sound => {
            const button = document.createElement('button');
            button.id = `button-${sound.id}`; // Unique ID for the button
            // Button content: sound name and category tag
            button.innerHTML = `<span>${sound.name}</span><span class="category-tag">${getCategoryName(sound.category)}</span>`;
            button.className = `sound-button button-${sound.color}`; // Apply base and color-specific classes
            button.dataset.soundId = sound.id; // Store sound ID for event handling
            button.dataset.soundName = sound.name.toLowerCase(); // Store lowercase name for search

            // Apply styles based on loading/error state
            if (sound.isLoading) button.classList.add('loading');
            else if (sound.hasError) button.classList.add('error');
            button.disabled = sound.isLoading || sound.hasError; // Disable button if loading or error
            if (sound.hasError) button.title = `Error loading ${sound.filePath || 'uploaded file'}. Check console.`;
            
            // Add visual cue (pencil icon) if in edit mode
            if (isEditMode) button.classList.add('editable-overlay');
            
            // Attach click event listener
            button.addEventListener('click', () => handleSoundButtonClick(sound.id)); 
            soundboardContainer.appendChild(button);
        });
    }

    /**
     * Loads pre-defined sounds (not uploaded ones) using Tone.Players.
     * Updates button states based on loading success or failure.
     * @param {Array} [soundsToLoad] - Specific sounds to load. Defaults to pre-defined sounds not yet loaded.
     */
    async function loadAndRenderSounds(soundsToLoad = soundsData.filter(s => !s.isUploaded && !s.player && !s.isLoading)) {
        soundsToLoad.forEach(s => s.isLoading = true); // Mark sounds as loading
        renderButtons(); // Re-render to show loading states on buttons

        const soundsToActuallyLoad = soundsToLoad.filter(s => s.filePath); // Filter out sounds without a filePath
        if (soundsToActuallyLoad.length === 0) {
            console.log("No new pre-defined sounds to load or all are already processed.");
            soundsToLoad.forEach(s => s.isLoading = false); // Clear loading state if nothing to load
            renderButtons();
            updateAudioStatusIfNeeded();
            return;
        }

        // Prepare URLs for Tone.Players, using sound ID as the key
        const playerUrls = {};
        soundsToActuallyLoad.forEach(sound => { playerUrls[sound.id] = sound.filePath; });
        audioStatusDiv.textContent = `Loading ${soundsToActuallyLoad.length} sound files...`;

        try {
            // Create a new Tone.Players instance and connect it to the destination (speakers)
            const newPlayersInstance = new Tone.Players(playerUrls).toDestination();
            // Tone.loaded() is a global promise that resolves when all Tone.js buffers are loaded
            await Tone.loaded(); 

            console.log('Tone.Players for pre-defined sounds loaded successfully.');
            // Update the state of each sound based on whether its player loaded
            soundsToActuallyLoad.forEach(sound => {
                const playerFromInstance = newPlayersInstance.player(sound.id); // Get the individual player
                sound.isLoading = false; // Mark as done attempting to load
                if (playerFromInstance && playerFromInstance.loaded) {
                    sound.player = playerFromInstance; // Store the loaded player instance
                    sound.hasError = false;
                } else {
                    sound.hasError = true; 
                    console.error(`Failed to load sound '${sound.name}': ${sound.filePath}. Player not loaded.`);
                }
            });
            
            // Assign to the global 'players' object if this is the first batch of sounds
            if (!players) players = newPlayersInstance;
            else { 
                // TODO: Implement merging logic if sounds are loaded in multiple batches for Tone.Players
                console.warn("Merging logic for subsequent Tone.Players batches might be needed for full robustness.");
            }
            
        } catch (e) {
            console.error("CRITICAL ERROR during Tone.Players instantiation or loading:", e);
            audioStatusDiv.textContent = "Fatal error creating sound player system. Check console.";
            soundsToActuallyLoad.forEach(s => { s.isLoading = false; s.hasError = true; }); // Mark all as error
        } finally {
            renderButtons(); // Re-render buttons with updated states (loaded or error)
            updateAudioStatusIfNeeded(); // Update the overall status message
        }
    }
    
    /**
     * Updates the audio status message div based on the current loading states of sounds.
     */
    function updateAudioStatusIfNeeded() {
        const stillLoading = soundsData.some(s => s.isLoading);
        if (stillLoading) return; // Don't update if some sounds are still in the process of loading

        const errorsExist = soundsData.some(s => s.hasError);
        const totalSounds = soundsData.length;
        const totalLoaded = soundsData.filter(s => (s.player || s.uploadedPlayer) && !s.hasError).length;

        // Set appropriate status message
        if (errorsExist) {
            audioStatusDiv.textContent = `Some sounds failed. ${totalLoaded}/${totalSounds} ready. Check console.`;
        } else if (totalLoaded === totalSounds && totalSounds > 0) {
            audioStatusDiv.textContent = `All ${totalLoaded} sounds loaded & ready!`;
        } else if (totalSounds === 0) {
             audioStatusDiv.textContent = "No sounds loaded.";
        } else if (totalLoaded < totalSounds && !errorsExist) {
             // This might happen if there are uploaded sounds still being processed individually
             audioStatusDiv.textContent = `${totalLoaded}/${totalSounds} sounds processed.`;
        }
        
        // Clear the status message after a few seconds
        setTimeout(() => { 
            if (audioStatusDiv.textContent.includes("loaded") || audioStatusDiv.textContent.includes("failed") || audioStatusDiv.textContent.includes("processed")) {
               audioStatusDiv.textContent = ''; 
            }
        }, 5000);
    }

    /**
     * Handles clicks on sound buttons. 
     * If in edit mode, opens the edit modal. Otherwise, plays the sound.
     * @param {string} soundId - The ID of the sound button that was clicked.
     */
    function handleSoundButtonClick(soundId) {
        const sound = soundsData.find(s => s.id === soundId);
        if (!sound) return; // Should not happen if IDs are consistent

        if (isEditMode) {
            openEditModal(sound); // Open edit modal for this sound
        } else {
            playSound(sound); // Play the sound
        }
    }

    /**
     * Plays the specified sound.
     * @param {object} sound - The sound object to play.
     */
    async function playSound(sound) {
        // Ensure audio context is active before playing
        if (!audioInitialized && Tone.context.state !== 'running') { 
            audioStatusDiv.textContent = "Audio not active. Click screen to enable.";
            return; 
        }
        // Determine which player to use (pre-defined or uploaded)
        const targetPlayer = sound.player || sound.uploadedPlayer; 
        if (targetPlayer && targetPlayer.loaded) {
            targetPlayer.start(Tone.now()); // Play the sound immediately
        } else {
            console.warn(`Cannot play sound '${sound.name}'. Not loaded or error.`);
            // Optionally, could add logic here to try loading it on demand if it failed previously
        }
    }

    // --- UPLOAD FUNCTIONALITY ---
    // Trigger hidden file input when "Upload" button is clicked
    uploadSoundButton.addEventListener('click', () => uploadSoundInput.click());
    
    // Handle file selection from the hidden input
    uploadSoundInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (!files.length) return; // No files selected

        audioStatusDiv.textContent = `Loading ${files.length} uploaded sound(s)...`;
        let newSoundsToProcess = []; // Array to hold newly uploaded sound objects

        // Process each selected file
        for (const file of files) {
            if (file.type !== 'audio/ogg') { 
                alert(`File "${file.name}" is not an OGG file and was skipped.`);
                continue; // Skip non-OGG files
            }
            const soundId = generateUniqueId();
            const objectURL = URL.createObjectURL(file); // Create a temporary local URL for the file
            
            // Create a display name from the filename
            let displayName = file.name.replace(/\.ogg$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            
            // Create new sound object for the uploaded file
            const newSound = {
                id: soundId, name: displayName, originalName: file.name, filePath: objectURL,
                color: availableButtonColors[soundsData.length % availableButtonColors.length], // Cycle through colors
                category: 'uncategorized', isUploaded: true, uploadedPlayer: null, isLoading: true, hasError: false
            };
            soundsData.push(newSound); // Add to the main sounds data array
            newSoundsToProcess.push(newSound);
        }
        renderButtons(); // Re-render to show new buttons in their loading state

        // Load each uploaded sound individually using Tone.Player
        for (const sound of newSoundsToProcess) {
            try {
                const player = new Tone.Player(sound.filePath).toDestination(); // Create player for the object URL
                await Tone.loaded(); // Wait for this specific player's buffer to load
                
                if (player.loaded) {
                    sound.uploadedPlayer = player; // Store the loaded player
                    sound.isLoading = false;
                    console.log(`Uploaded sound '${sound.name}' loaded.`);
                } else {
                    // This case might be hard to hit if Tone.loaded() is used correctly,
                    // as Tone.loaded() should reject if a buffer fails.
                    throw new Error("Player did not report as loaded after Tone.loaded() resolved for uploaded file.");
                }
            } catch (error) {
                console.error(`Error loading uploaded sound '${sound.name}':`, error);
                sound.isLoading = false; 
                sound.hasError = true; 
                URL.revokeObjectURL(sound.filePath); // Clean up the object URL if loading failed
            }
        }
        renderButtons(); // Re-render with updated states for uploaded sounds
        updateAudioStatusIfNeeded(); 
        uploadSoundInput.value = ''; // Reset file input to allow uploading the same file again if needed
    });

    // --- EDIT MODE & SOUND EDIT MODAL ---
    // Toggle edit mode
    editModeButton.addEventListener('click', () => {
        isEditMode = !isEditMode; // Toggle the state
        editModeButton.classList.toggle('active', isEditMode); // Add/remove 'active' class for styling
        // Update button text/icon based on mode
        editModeButton.innerHTML = isEditMode ? '<i class="fas fa-check"></i> Done Editing' : '<i class="fas fa-edit"></i> Edit Mode';
        renderButtons(); // Re-render buttons to apply/remove 'editable-overlay' class
    });

    /**
     * Opens the "Edit Sound" modal and populates it with the given sound's data.
     * @param {object} sound - The sound object to edit.
     */
    function openEditModal(sound) {
        editModalTitle.textContent = `Edit: ${sound.name}`; // Set modal title
        editSoundIdInput.value = sound.id; // Store sound ID in hidden input
        editSoundNameInput.value = sound.name; // Populate name input
        editSoundColorSelect.value = sound.color; // Set color dropdown
        editSoundCategorySelect.value = sound.category; // Set category dropdown
        editNewCategoryNameInput.value = ''; // Clear the "new category name" input
        editModal.style.display = 'flex'; // Show the modal
    }

    // Close "Edit Sound" modal when "Cancel" is clicked
    cancelEditButton.addEventListener('click', () => { editModal.style.display = 'none'; });

    // Save changes from the "Edit Sound" modal
    saveEditButton.addEventListener('click', () => {
        const soundId = editSoundIdInput.value;
        const sound = soundsData.find(s => s.id === soundId);
        if (!sound) return; // Should not happen

        sound.name = editSoundNameInput.value.trim() || sound.name; // Update name, fallback to old name if empty
        sound.color = editSoundColorSelect.value; // Update color

        const newCategoryName = editNewCategoryNameInput.value.trim();
        if (newCategoryName) { // If user typed a new category name
            let existingCategory = categories.find(cat => cat.name.toLowerCase() === newCategoryName.toLowerCase());
            if (!existingCategory) { // Create the new category if it doesn't exist
                existingCategory = { id: generateUniqueId(), name: newCategoryName, isDeletable: true, isEditable: true };
                categories.push(existingCategory);
                populateCategoryDropdowns(); // Update all category dropdowns in the UI
                renderCategoryList(); // Update the list in the "Manage Categories" modal
            }
            sound.category = existingCategory.id; // Assign the new or existing category ID to the sound
        } else { // User selected from the existing categories dropdown
            sound.category = editSoundCategorySelect.value;
        }
        
        renderButtons(); // Re-render sound buttons to reflect changes
        editModal.style.display = 'none'; // Hide the modal
    });

    // --- CATEGORY MANAGEMENT ---
    // Open "Manage Categories" modal
    manageCategoriesButton.addEventListener('click', () => {
        renderCategoryList(); // Populate the list of categories in the modal
        manageCategoriesModal.style.display = 'flex'; // Show the modal
    });

    // Close "Manage Categories" modal
    closeManageCategoriesButton.addEventListener('click', () => { manageCategoriesModal.style.display = 'none';});

    // Add a new category
    addCategoryButton.addEventListener('click', () => {
        const name = newCategoryInputName.value.trim();
        // Check if name is valid and not a duplicate (case-insensitive)
        if (name && !categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            categories.push({ id: generateUniqueId(), name: name, isDeletable: true, isEditable: true });
            newCategoryInputName.value = ''; // Clear the input field
            populateCategoryDropdowns(); // Update UI dropdowns
            renderCategoryList(); // Re-render the list in the modal
            renderButtons(); // Re-render sound buttons if category display might have changed for some
        } else if (name) {
            alert("Category name already exists or is invalid.");
        } else {
            alert("Category name cannot be empty.");
        }
    });

    /**
     * Renders the list of categories in the "Manage Categories" modal.
     * Includes buttons for editing and deleting each category.
     */
    function renderCategoryList() {
        categoryListUl.innerHTML = ''; // Clear current list
        categories.forEach(cat => {
            const li = document.createElement('li');
            li.dataset.categoryId = cat.id; // Store category ID on the list item
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = cat.name;
            nameSpan.className = 'category-name-span'; // For styling and selection
            li.appendChild(nameSpan);

            const buttonsDiv = document.createElement('div'); // Container for edit/delete buttons
            // Add edit button if the category is marked as editable
            if (cat.isEditable !== false) { // Default to true if undefined
                const editBtn = document.createElement('button');
                editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>'; // Pencil icon
                editBtn.className = 'icon-button edit-category-btn';
                editBtn.onclick = () => editCategoryNameUI(cat.id, li, nameSpan); // Pass elements for UI manipulation
                buttonsDiv.appendChild(editBtn);
            }
            // Add delete button if the category is marked as deletable
            if (cat.isDeletable !== false) { // Default to true if undefined
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Trash icon
                deleteBtn.className = 'icon-button delete-category-btn';
                deleteBtn.onclick = () => deleteCategory(cat.id);
                buttonsDiv.appendChild(deleteBtn);
            }
            li.appendChild(buttonsDiv);
            categoryListUl.appendChild(li);
        });
    }

    /**
     * Handles the UI part of editing a category name inline within the "Manage Categories" modal.
     * Replaces the category name span with an input field for editing.
     * @param {string} categoryId - The ID of the category to edit.
     * @param {HTMLElement} listItem - The <li> element of the category.
     * @param {HTMLElement} nameSpan - The <span> element displaying the category name.
     */
    function editCategoryNameUI(categoryId, listItem, nameSpan) {
        const currentName = nameSpan.textContent;
        const input = document.createElement('input'); // Create an input field
        input.type = 'text';
        input.value = currentName;
        input.className = 'py-1 px-2 rounded border border-gray-600 bg-gray-700 text-white'; // Style like other inputs
        
        const saveBtn = document.createElement('button'); // Create a save button
        saveBtn.innerHTML = '<i class="fas fa-check"></i>'; // Checkmark icon
        saveBtn.className = 'icon-button';
        saveBtn.onclick = () => {
            const newName = input.value.trim();
            // Validate new name: must exist, be different, and not a duplicate (case-insensitive)
            if (newName && newName !== currentName && !categories.some(c => c.id !== categoryId && c.name.toLowerCase() === newName.toLowerCase())) {
                const category = categories.find(c => c.id === categoryId);
                if (category) category.name = newName; // Update category name in data
                populateCategoryDropdowns(); // Update all UI dropdowns
                renderCategoryList(); // Re-render the category list to reflect change and restore buttons
                renderButtons(); // Re-render sound buttons to update category tags if names changed
            } else if (newName === currentName) {
                // If name didn't change, just revert UI without saving (re-render list)
                renderCategoryList(); 
            } 
            else if (!newName) alert("Category name cannot be empty.");
            else alert("Category name already exists or is invalid.");
        };

        // Replace the name span with the input field
        listItem.replaceChild(input, nameSpan);
        // Replace the edit button with the save button
        const editButtonElement = listItem.querySelector('.edit-category-btn');
        if(editButtonElement && editButtonElement.parentElement) { 
             editButtonElement.parentElement.replaceChild(saveBtn, editButtonElement);
        } else { 
            // Fallback if the structure is unexpected, try to append save button to the buttonsDiv
            const buttonsDiv = listItem.querySelector('div'); // Assuming buttons are in a div
            if(buttonsDiv) buttonsDiv.appendChild(saveBtn); // This might add an extra button if editBtn wasn't found
        }
        input.focus(); // Automatically focus on the input field
    }

    /**
     * Deletes a category. Sounds in the deleted category are moved to "Uncategorized".
     * @param {string} categoryId - The ID of the category to delete.
     */
    function deleteCategory(categoryId) {
        const categoryToDelete = categories.find(cat => cat.id === categoryId);
        // Prevent deletion of special categories (like 'uncategorized' if marked as not deletable)
        if (!categoryToDelete || categoryToDelete.isDeletable === false) {
            alert(`Cannot delete the "${getCategoryName(categoryId)}" category.`);
            return;
        }
        // Confirm deletion with the user
        if (confirm(`Are you sure you want to delete the category "${getCategoryName(categoryId)}"? Sounds in it will be moved to "Uncategorized".`)) {
            // Reassign sounds from the deleted category to 'uncategorized'
            soundsData.forEach(sound => {
                if (sound.category === categoryId) {
                    sound.category = 'uncategorized';
                }
            });
            categories = categories.filter(cat => cat.id !== categoryId); // Remove category from the list
            populateCategoryDropdowns(); // Update UI dropdowns
            renderCategoryList(); // Re-render category management list
            renderButtons(); // Update sound buttons to reflect category changes
        }
    }
    
    /**
     * Populates all category dropdowns in the UI (filter dropdown, edit sound modal dropdown).
     * Attempts to preserve the currently selected value if possible.
     */
    function populateCategoryDropdowns() {
        // Store current selections to try and restore them
        const currentFilterVal = categoryFilterDropdown.value;
        const currentEditVal = editSoundCategorySelect.value;

        // Clear existing options
        categoryFilterDropdown.innerHTML = '<option value="all">All Categories</option>';
        editSoundCategorySelect.innerHTML = ''; 

        // Add an option for each category
        categories.forEach(cat => {
            const optionFilter = document.createElement('option');
            optionFilter.value = cat.id; optionFilter.textContent = cat.name;
            categoryFilterDropdown.appendChild(optionFilter);

            const optionEdit = document.createElement('option');
            optionEdit.value = cat.id; optionEdit.textContent = cat.name;
            editSoundCategorySelect.appendChild(optionEdit);
        });

        // Attempt to restore previous selection in the filter dropdown
        if (Array.from(categoryFilterDropdown.options).some(opt => opt.value === currentFilterVal)) {
            categoryFilterDropdown.value = currentFilterVal;
        } else {
            categoryFilterDropdown.value = "all"; // Default to "All Categories"
        }

        // Attempt to restore previous selection in the edit modal dropdown
        if (Array.from(editSoundCategorySelect.options).some(opt => opt.value === currentEditVal)) {
            editSoundCategorySelect.value = currentEditVal;
        } else if (editSoundCategorySelect.options.length > 0) {
            // If previous selection is no longer valid, select the first available option
            editSoundCategorySelect.value = editSoundCategorySelect.options[0].value; 
        } else {
            // Fallback if no categories exist (should not happen with the default "Uncategorized")
            editSoundCategorySelect.value = 'uncategorized'; 
        }
    }

    /**
     * Helper function to get the display name of a category by its ID.
     * @param {string} categoryId - The ID of the category.
     * @returns {string} The name of the category, or 'Unknown' if not found.
     */
    function getCategoryName(categoryId) { 
        const cat = categories.find(c => c.id === categoryId); 
        return cat ? cat.name : 'Unknown'; 
    }

    /**
     * Filters and sorts the soundsData array based on current UI selections.
     * @param {Array} [sourceData=soundsData] - The array of sound objects to process.
     * @returns {Array} A new array of sounds, filtered and sorted.
     */
    function getFilteredAndSortedSounds(sourceData = soundsData) {
        let result = [...sourceData]; // Create a copy to avoid modifying the original array

        // Apply category filter
        const selectedCategoryId = categoryFilterDropdown.value;
        if (selectedCategoryId !== 'all') {
            result = result.filter(sound => sound.category === selectedCategoryId);
        }
        // Apply search term filter (case-insensitive)
        const searchTerm = searchInput.value.toLowerCase();
        if (searchTerm) {
            result = result.filter(sound => sound.name.toLowerCase().includes(searchTerm));
        }
        // Apply sorting
        const sortBy = sortByDropdown.value;
        if (sortBy === 'name-asc') {
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'name-desc') {
            result.sort((a, b) => b.name.localeCompare(a.name));
        } else if (sortBy === 'category') {
            // Sort by category name, then by sound name within each category
            result.sort((a,b) => getCategoryName(a.category).localeCompare(getCategoryName(b.category)) || a.name.localeCompare(b.name));
        }
        return result;
    }

    // Event listeners for filter and sort dropdowns to re-render buttons on change
    categoryFilterDropdown.addEventListener('change', () => renderButtons());
    sortByDropdown.addEventListener('change', () => renderButtons());
    searchInput.addEventListener('input', () => renderButtons()); // Re-render on search input

    // --- STOP ALL SOUNDS ---
    // Stops all currently playing sounds
    stopAllButton.addEventListener('click', async () => {
        if (!audioInitialized && Tone.context.state !== 'running') { return; } // Guard if audio not ready
        
        let stoppedCount = 0;
        soundsData.forEach(sound => {
            const p = sound.player || sound.uploadedPlayer; // Check both preloaded and uploaded players
            if (p && p.loaded && p.state === "started") { // If player exists, is loaded, and is playing
                p.stop(Tone.now()); // Stop the player
                stoppedCount++; 
            }
        });
        
        // Legacy check for the main 'players' object, might be redundant if all players are managed within soundsData
        if (players && players._players) { 
            Object.values(players._players).forEach(p => {
                 if (p && p.loaded && p.state === "started") { p.stop(Tone.now()); stoppedCount++;}
            });
        }
        
        audioStatusDiv.textContent = stoppedCount > 0 ? 'All sounds stopped.' : 'No sounds were playing.';
        setTimeout(() => { audioStatusDiv.textContent = ''; }, 1500); // Clear message after delay
    });

    // --- INITIALIZATION SEQUENCE ---
    await fetchSoundManifest();
    initializeSoundsData(); // Prepare sound objects from the initialSoundFiles list
    initializeAudio();      // Initialize Tone.js audio context and start loading sounds
});
    </script>
</body>
</html>
