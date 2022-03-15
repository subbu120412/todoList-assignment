const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { format, isValid } = require("date-fns");
const app = express();
const dbPath = path.join(__dirname, "todoApplication.db");
app.use(express.json());

let database = null;
const possibleStatus = ["TO DO", "IN PROGRESS", "DONE"];
const possiblePriority = ["HIGH", "MEDIUM", "LOW"];
const possibleCategory = ["WORK", "HOME", "LEARNING"];

const initializeServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("The server is running");
    });
  } catch (e) {
    console.log(`DB ERROR : ${e.message}`);
    process.exit(1);
  }
};

initializeServer();

function convertTodoObject(todo) {
  return {
    id: todo.id,
    todo: todo.todo,
    priority: todo.priority,
    category: todo.category,
    status: todo.status,
    dueDate: todo.due_date,
  };
}

function statusValidation(request, response, next) {
  const {
    status = "",
    priority = "",
    category = "",
    search_q = "",
  } = request.query;

  function errorMessage(item) {
    response.status(400);
    response.send(`Invalid Todo ${item}`);
  }

  if (status !== "" && priority === "" && category === "") {
    if (possibleStatus.includes(status)) {
      next();
    } else {
      errorMessage("Status");
    }
  } else if (status === "" && priority !== "" && category === "") {
    if (possiblePriority.includes(priority)) {
      next();
    } else {
      errorMessage("Priority");
    }
  } else if (status === "" && priority === "" && category !== "") {
    if (possibleCategory.includes(category)) {
      next();
    } else {
      errorMessage("Category");
    }
  } else if (status !== "" && priority !== "" && category === "") {
    if (possiblePriority.includes(priority)) {
      if (possibleStatus.includes(status)) {
        next();
      } else {
        errorMessage("Status");
      }
    } else {
      errorMessage("Priority");
    }
  } else if (status !== "" && priority === "" && category !== "") {
    if (possibleCategory.includes(category)) {
      if (possibleStatus.includes(status)) {
        next();
      } else {
        errorMessage("Status");
      }
    } else {
      errorMessage("Category");
    }
  } else if (status === "" && priority !== "" && category !== "") {
    if (possibleCategory.includes(category)) {
      if (possiblePriority.includes(priority)) {
        next();
      } else {
        errorMessage("Priority");
      }
    } else {
      errorMessage("Category");
    }
  }
  if (search_q !== "") {
    next();
  }
}
// get

app.get("/todos/", statusValidation, async (request, response) => {
  const {
    status = "",
    priority = "",
    category = "",
    search_q = "",
  } = request.query;
  let getTodoQuery;
  if (search_q !== "") {
    getTodoQuery = `SELECT * FROM todo WHERE todo LIKE'%${search_q}%';`;
  }
  if (status !== "" && priority === "" && category === "") {
    getTodoQuery = `SELECT * FROM todo WHERE status LIKE '%${status}%';`;
  } else if (status === "" && priority !== "" && category === "") {
    getTodoQuery = `SELECT * FROM todo WHERE priority LIKE '%${priority}%';`;
  } else if (status === "" && priority === "" && category !== "") {
    getTodoQuery = `SELECT * FROM todo WHERE category LIKE '%${category}%';`;
  } else if (status !== "" && priority !== "" && category === "") {
    getTodoQuery = `SELECT * FROM todo WHERE priority LIKE '%${priority}%' AND status LIKE '%${status}%';`;
  } else if (status !== "" && priority === "" && category !== "") {
    getTodoQuery = `SELECT * FROM todo WHERE category LIKE '%${category}%' AND status LIKE '%${status}%';`;
  } else if (status === "" && priority !== "" && category !== "") {
    getTodoQuery = `SELECT * FROM todo WHERE category LIKE '%${category}%' AND priority LIKE '%${priority}%';`;
  }
  const todoList = await database.all(getTodoQuery);
  response.send(todoList.map(convertTodoObject));
});

// GET ID
app.get("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  console.log(todoId);
  const getTodoQuery = `SELECT * FROM todo WHERE id = ${todoId};`;
  const todo = await database.get(getTodoQuery);
  response.send(convertTodoObject(todo));
});

//agenda

function dateValidation(request, response, next) {
  let { date } = request.query;
  date = new Date(date);

  const isDateValid = isValid(date);
  if (isDateValid) {
    next();
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
}

app.get("/agenda/", dateValidation, async (request, response) => {
  let { date } = request.query;
  date = new Date(date);
  const getTodoQuery = `
    SELECT * FROM todo WHERE 
    strftime("%Y",due_date)='${date.getFullYear()}' AND
    CAST(strftime("%m",due_date) AS INT)='${date.getMonth() + 1}' AND
    CAST(strftime("%d",due_date) AS INT) = '${date.getDate()}'`;
  const todo = await database.all(getTodoQuery);
  response.send(todo.map(convertTodoObject));
});

//post
function scenarioValidation(request, response, next) {
  const {
    status = "",
    priority = "",
    category = "",
    dueDate = "",
  } = request.body;
  function errorMessage(item) {
    response.status(400);
    response.send(`Invalid Todo ${item}`);
  }
  if (possibleStatus.includes(status) || status === "") {
    if (possibleCategory.includes(category) || category === "") {
      if (possiblePriority.includes(priority) || priority === "") {
        date = new Date(dueDate);
        console.log(dueDate);
        const isDateValid = isValid(date);
        if (isDateValid || dueDate === "") {
          next();
        } else {
          response.status(400);
          response.send("Invalid Due Date");
        }
      } else {
        errorMessage("Priority");
      }
    } else {
      errorMessage("Category");
    }
  } else {
    errorMessage("Status");
  }
}
//api 4

app.post("/todos/", scenarioValidation, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const postTodoQuery = `
    INSERT INTO
     todo (id,todo,priority,status,category,due_date)
    VALUES (${id},'${todo}','${priority}','${status}','${category}','${dueDate}');
    `;
  await database.run(postTodoQuery);
  response.send("Todo Successfully Added");
});
// api 5

app.put("/todos/:todoId", scenarioValidation, async (request, response) => {
  const { todoId } = request.params;
  const { status, category, priority, dueDate, todo } = request.body;
  let updateQuery;
  let responseText;
  switch (true) {
    case status !== undefined:
      updateQuery = `UPDATE todo SET status = '${status}' WHERE id = ${todoId}`;
      responseText = "Status Updated";
      break;
    case category !== undefined:
      updateQuery = `UPDATE todo SET category = '${category}' WHERE id = ${todoId}`;
      responseText = "Category Updated";
      break;
    case priority !== undefined:
      updateQuery = `UPDATE todo SET priority = '${priority}' WHERE id = ${todoId}`;
      responseText = "Priority Updated";
      break;
    case todo !== undefined:
      updateQuery = `UPDATE todo SET todo = '${todo}' WHERE id = ${todoId}`;
      responseText = "Todo Updated";
      break;
    case dueDate !== undefined:
      updateQuery = `UPDATE todo SET due_date = '${dueDate}' WHERE id = ${todoId}`;
      responseText = "Due Date Updated";
      break;
  }
  await database.run(updateQuery);
  response.send(responseText);
});
//api 6

app.delete("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const deleteQuery = `
    DELETE FROM todo WHERE id = ${todoId};`;
  await database.run(deleteQuery);
  response.send("Todo Deleted");
});

module.exports = app;
