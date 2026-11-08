
let config;
let editingId = null;
let tasks = [];

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput =
    document.getElementById("task-description");
const submitButton =
    document.getElementById("task-submit");
const taskList = document.getElementById("task-list");
const statusMessage =
    document.getElementById("status-message");

// Display success and error messages
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className =
        isError ? "error" : "success";
}

// Communicate with Supabase REST API
async function apiRequest(path, options = {}) {
    const response = await fetch(
        `${config.supabaseUrl}/rest/v1/${path}`,
        {
            ...options,
            headers: {
                "apikey": config.supabasePublishableKey,
                "Content-Type": "application/json",
                ...options.headers
            }
        }
    );

    if (!response.ok) {
        let details = response.statusText;

        try {
            const error = await response.json();
            details = error.message || details;
        } catch (_) {}

        throw new Error(details);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

// GET - Display all tasks
async function loadTasks() {
    try {
        tasks = await apiRequest(
            `${config.tableName}?select=*&order=id.asc`
        );

        displayTasks();
    } catch (error) {
        showStatus(
            "Failed to load tasks: " + error.message,
            true
        );
    }
}

// GET - Retrieve a task by ID
async function getTaskById(id) {
    const result = await apiRequest(
        `${config.tableName}?id=eq.${id}&select=*`
    );

    return result[0] || null;
}

// Display tasks on the page
function displayTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
        taskList.textContent = "No tasks available.";
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";
        item.dataset.id = task.id;

        if (task.completed) {
            item.classList.add("completed");
        }

        const title = document.createElement("h3");
        title.className = "task-title";
        title.textContent = task.title;

        const description = document.createElement("p");
        description.className = "task-description";
        description.textContent = task.description || "";

        const status = document.createElement("p");
        status.className = "task-status";
        status.textContent = task.completed
            ? "Completed"
            : "Incomplete";

        const actions = document.createElement("div");
        actions.className = "task-actions";

        const editButton = document.createElement("button");
        editButton.className = "edit-task";
        editButton.textContent = "Edit";
        editButton.onclick = () => editTask(task.id);

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-task";
        deleteButton.textContent = "Delete";
        deleteButton.onclick = () => deleteTask(task.id);

        const toggleButton = document.createElement("button");
        toggleButton.className = "toggle-task";
        toggleButton.textContent = task.completed
            ? "Mark Incomplete"
            : "Mark Complete";
        toggleButton.onclick = () => toggleTask(task.id);

        actions.append(
            editButton,
            deleteButton,
            toggleButton
        );

        item.append(title, description, status, actions);
        taskList.appendChild(item);
    });
}

// POST - Add a new task
async function addTask(title, description) {
    await apiRequest(config.tableName, {
        method: "POST",
        headers: {
            "Prefer": "return=representation"
        },
        body: JSON.stringify({
            title,
            description,
            completed: false
        })
    });
}

// PATCH - Update an existing task
async function updateTask(id, changes) {
    await apiRequest(
        `${config.tableName}?id=eq.${id}`,
        {
            method: "PATCH",
            headers: {
                "Prefer": "return=representation"
            },
            body: JSON.stringify(changes)
        }
    );
}

// Edit a task
async function editTask(id) {
    try {
        const task = await getTaskById(id);

        if (!task) {
            throw new Error("Task not found");
        }

        editingId = id;
        titleInput.value = task.title;
        descriptionInput.value = task.description || "";
        submitButton.textContent = "Save Changes";
        titleInput.focus();

    } catch (error) {
        showStatus(error.message, true);
    }
}

// Mark task completed or incomplete
async function toggleTask(id) {
    try {
        const task = await getTaskById(id);

        if (!task) {
            throw new Error("Task not found");
        }

        await updateTask(id, {
            completed: !task.completed
        });

        showStatus("Task status updated.");
        await loadTasks();

    } catch (error) {
        showStatus(error.message, true);
    }
}

// DELETE - Remove a task
async function deleteTask(id) {
    if (!confirm("Delete this task?")) {
        return;
    }

    try {
        await apiRequest(
            `${config.tableName}?id=eq.${id}`,
            { method: "DELETE" }
        );

        if (editingId === id) {
            resetForm();
        }

        showStatus("Task deleted successfully.");
        await loadTasks();

    } catch (error) {
        showStatus(error.message, true);
    }
}

// Reset form after adding or editing
function resetForm() {
    form.reset();
    editingId = null;
    submitButton.textContent = "Add Task";
}

// Handle form submission
form.addEventListener("submit", async event => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        showStatus("Task title is required.", true);
        return;
    }

    submitButton.disabled = true;

    try {
        if (editingId !== null) {
            await updateTask(editingId, {
                title,
                description
            });

            showStatus("Task updated successfully.");
        } else {
            await addTask(title, description);
            showStatus("Task added successfully.");
        }

        resetForm();
        await loadTasks();

    } catch (error) {
        showStatus(error.message, true);
    } finally {
        submitButton.disabled = false;
    }
});

// Initialize Supabase connection
async function initializeApp() {
    try {
        const response = await fetch("config.json");

        if (!response.ok) {
            throw new Error("Could not load config.json");
        }

        config = await response.json();

        if (
            !config.supabaseUrl ||
            !config.supabasePublishableKey ||
            config.tableName !== "tasks"
        ) {
            throw new Error("Invalid Supabase configuration");
        }

        config.supabaseUrl =
            config.supabaseUrl.replace(/\/$/, "");

        await loadTasks();

    } catch (error) {
        showStatus(
            "Initialization failed: " + error.message,
            true
        );
    }
}

initializeApp();
