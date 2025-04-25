import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import axios from "axios";
import { Container, Card, Button, Form, Row, Col, Alert, Badge } from "react-bootstrap";
import { FiPlus, FiEdit2, FiTrash2, FiShare2, FiLogIn } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

const API_URL = process.env.REACT_APP_API_URL;

const columnsFromBackend = {
  todo: { name: "To Do", items: [] },
  inprogress: { name: "In Progress", items: [] },
  done: { name: "Done", items: [] }
};

const Dashboard = () => {
  const [columns, setColumns] = useState(columnsFromBackend);
  const [newTask, setNewTask] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleUnauthorized = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const checkAuthError = (error) => {
    // Handle axios errors
    if (error.response?.status === 401) {
      handleUnauthorized();
      return true;
    }
    
    // Handle fetch errors
    if (error instanceof Response && error.status === 401) {
      handleUnauthorized();
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      setError("");
      const res = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const tasks = res.data;
      const updatedColumns = {
        todo: { ...columns.todo, items: tasks.filter(t => t.status === "todo") },
        inprogress: { ...columns.inprogress, items: tasks.filter(t => t.status === "inprogress") },
        done: { ...columns.done, items: tasks.filter(t => t.status === "done") }
      };
      setColumns(updatedColumns);
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to fetch tasks", error);
        setError("Failed to load tasks. Please refresh the page.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      handleUnauthorized();
      return;
    }
    if (!newTask.trim()) return;

    try {
      setError("");
      await axios.post(
        `${API_URL}/tasks`,
        { title: newTask, description: "", status: "todo" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewTask("");
      fetchTasks();
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to add task:", error);
        setError("Failed to add task. Please try again.");
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTasks();
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to delete task:", error);
        setError("Failed to delete task.");
      }
    }
  };

  const handleEditTask = async (task) => {
    const newTitle = prompt("Edit task title:", task.title);
    if (newTitle && newTitle !== task.title) {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        await axios.put(
          `${API_URL}/tasks/${task.id}`,
          { title: newTitle, status: task.status },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchTasks();
      } catch (error) {
        if (!checkAuthError(error)) {
          console.error("Failed to edit task:", error);
          setError("Failed to edit task.");
        }
      }
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) {
      const sourceColumn = columns[source.droppableId];
      const destColumn = columns[destination.droppableId];
      const sourceItems = [...sourceColumn.items];
      const destItems = [...destColumn.items];
      const [movedItem] = sourceItems.splice(source.index, 1);
      movedItem.status = destination.droppableId;
      destItems.splice(destination.index, 0, movedItem);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
        [destination.droppableId]: { ...destColumn, items: destItems }
      });

      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      axios.put(
        `${API_URL}/tasks/${movedItem.id}`,
        { status: movedItem.status },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(error => {
        if (!checkAuthError(error)) {
          console.error("Failed to update task status:", error);
          setError("Failed to update task status.");
        }
      });
    }
  };

  const handleCreateRoom = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      setJoinMessage("");
      const res = await fetch(`${API_URL}/create-room`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create room");
      }

      const data = await res.json();
      setNewRoomCode(data.code);
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to create room", error);
        setJoinMessage(error.message || "Error creating room");
      }
    }
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) {
      setJoinMessage("Please enter a room code");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      setJoinMessage("");
      const res = await fetch(`${API_URL}/join-room`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: joinInput.trim().toUpperCase() })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to join room");
      }

      const data = await res.json();
      setRoomCode(data.code);
      setJoinMessage(`Joined room ${data.code}`);
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to join room", error);
        setJoinMessage(error.message || "Error joining room");
      }
    }
  };

  return (
    <Container fluid className="dashboard-container py-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-bold">Task Board</h2>
          {error && <Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>}
        </Col>
      </Row>

      {/* Room Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Card.Title className="mb-3">Collaboration Room</Card.Title>
          
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Button 
                variant="primary" 
                onClick={handleCreateRoom} 
                className="w-50"
                disabled={isLoading}
              >
                <FiShare2 className="me-2" /> Create Room
              </Button>
              {newRoomCode && (
                <div className="mt-2">
                  <p className="mb-1">Share this code with others:</p>
                  <Badge bg="success" className="fs-6">{newRoomCode}</Badge>
                </div>
              )}
            </Col>
            
            <Col md={6}>
              <div className="d-flex">
                <Form.Control
                  type="text"
                  placeholder="Enter Room Code"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  className="me-2"
                  disabled={isLoading}
                />
                <Button 
                  variant="primary" 
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                >
                  <FiLogIn className="me-1" /> Join
                </Button>
              </div>
              {joinMessage && (
                <Alert variant={joinMessage.includes("Joined") ? "success" : "warning"} className="mt-2 mb-0">
                  {joinMessage}
                </Alert>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Task Input */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleAddTask} className="d-flex">
            <Form.Control
              type="text"
              placeholder="Enter a new task"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="me-2"
              disabled={isLoading}
            />
            <Button 
              variant="primary" 
              className="col-sm-2" 
              type="submit"
              disabled={isLoading}
            >
              <FiPlus className="me-1" /> Add Task
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Row className="g-3">
          {Object.entries(columns).map(([columnId, column]) => (
            <Col key={columnId} md={4}>
              <Card className={`h-100 border-0 shadow-sm column column-${columnId}`}>
                <Card.Header className="bg-transparent border-0">
                  <h5 className="fw-bold mb-0">{column.name}</h5>
                </Card.Header>
                <Card.Body className="p-3">
                  <Droppable droppableId={columnId}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="droppable-col"
                      >
                        {column.items.map((item, index) => (
                          <Draggable
                            key={item.id.toString()}
                            draggableId={item.id.toString()}
                            index={index}
                          >
                            {(provided) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="mb-2 task-card shadow-sm"
                              >
                                <Card.Body className="p-3 d-flex justify-content-between align-items-center">
                                  <span>{item.title}</span>
                                  <div className="card-buttons">
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => handleEditTask(item)}
                                      className="text-primary p-0"
                                      disabled={isLoading}
                                    >
                                      <FiEdit2 />
                                    </Button>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => handleDeleteTask(item.id)}
                                      className="text-danger p-0 ms-2"
                                      disabled={isLoading}
                                    >
                                      <FiTrash2 />
                                    </Button>
                                  </div>
                                </Card.Body>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </DragDropContext>
    </Container>
  );
};

export default Dashboard;