import { Application, Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import data from "./data.json" assert { type: "json" };
import hash from "https://deno.land/x/object_hash@2.0.3.1/mod.ts";

const byteSize = str => new Blob([str]).size;
    
const API_TOKEN_DENO = Deno.env.get("API_TOKEN_DENO");
const HASURA_ORG_ID_DENO = "22931876-226c-4cbd-9f56-964c80efa2c6"

const listDenoProjects = async () => {
  try {
    let resp = await fetch("https://api.deno.com/projects", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + API_TOKEN_DENO,
      },
    });
    if (resp?.status == 200) {
      let body = await resp.json()
      console.log(body)
      return body;
    } else {
      console.log(resp.status)
      return null
    }
  } catch (error) {
    console.log(error);
    return null
  }
}

const createDenoProject = async () => {
  const requestBody = {
    organizationId: HASURA_ORG_ID_DENO,
  };
  try {
    let resp = await fetch("https://api.deno.com/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_TOKEN_DENO,
      },
      body: JSON.stringify(requestBody),
    });
    if (resp?.status == 200) {
      let body = await resp.json()
      return body;
    } else {
      console.log(resp.status)
      return null
    }
  } catch (error) {
    console.log(error);
    return null
  }
}

const deleteDenoProject = async (projectId) => {
  const requestBody = {
    projectId
  }
  try {
    let resp = await fetch("https://api.deno.com/projects/" + projectId, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + API_TOKEN_DENO,
      },
    });
    return resp?.status;
  } catch (error) {
    console.log(error);
    return null
  }
}

const deployDenoProject = async (projectId, file) => {

  const fileSize = byteSize(file);
  const sha1 = hash.sha1(file)
  console.log({file, fileSize, sha1})
  console.log(file)

  const form = new FormData();
  form.append("request", JSON.stringify({
    url: "file:///src/main.ts",
    production: false,
    manifest: {
      entries: {
        "main.ts": {
          kind: "file",
          size: fileSize,
          gitSha1: "7094058cd3212c8bc97284db553ea461c5be1274"
        }
      }
    }

  }));
  form.append("file", file);
  
  try {
    const resp = await fetch(
      `https://api.deno.com/projects/${projectId}/deployment_with_assets`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + API_TOKEN_DENO
        },
        body: form
      }
    );

    if (resp.status == 200) {
      const data = await resp.json();
      console.log({data});
      return data;
    } else {
      console.log({errorResp: await resp.json()})
      return null
    }
    
  } catch (error) {
    console.log(error);
    return null
  }

}

const router = new Router();
router
  .get("/list", async (context) => {
    // list deno projects for this user
    let projects = await listDenoProjects();
    if (projects) {
      context.response.status = 200;
      context.response.body = projects;
      return
    }
    context.response.status = 500;
    context.response.body = {
      error: "failed listing functions"
    }
  })
  .post("/create", async (context) => {
    // create a new deno project
    let denoProject = await createDenoProject();
    console.log(denoProject);
    if (denoProject) {
      context.response.status = 201;
      context.response.body = {
        name: denoProject.name,
        id: denoProject.id
      }
      return
    }
    context.response.status = 500;
    context.response.body = {
      error: "failed creating function"
    }
  })
  .delete("/delete/:projectId", async (context) => {
    // delete a deno project
    let projectId = context.params.projectId;
    let deletedProject = await deleteDenoProject(projectId)
    if (deletedProject == 200) {
      context.response.status = 200;
      context.response.body = {
        projectId,
        deleted: true
      }
      return
    }
    context.response.status = 500;
    context.response.body = {
      error: "failed deleting function"
    }

  })
  .post("/deploy/:projectId", async (context) => {
    // deploy code to a deno project
    let projectId = context.params.projectId;

    const body = context.request.body();
    if (body.type === "form-data") {
      const value = body.value;
      const formData = await value.read();
      // the form data is fully available
      console.log(formData)
    }

    console.log(body.get(hash))

    console.log({projectId});
    console.log({reqBody});

    let deployedProject = await deployDenoProject(projectId, reqBody.file)
    if (deployedProject) {
    
      context.response.status = 200;
      context.response.body = {
      }
      return
    }
    context.response.status = 500;
    context.response.body = {
      error: "failed deploying function"
    }

    context.response.body = "deploy api"
  })
  .get("/api", (context) => {
    context.response.body = data;
  })
  .get("/api/:dinosaur", (context) => {
    if (context?.params?.dinosaur) {
      const found = data.find((item) =>
        item.name.toLowerCase() === context.params.dinosaur.toLowerCase()
      );
      if (found) {
        context.response.body = found;
      } else {
        context.response.body = "No dinosaurs found.";
      }
    }
  });

const app = new Application();
app.use(oakCors()); // Enable CORS for All Routes
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 8000 });
