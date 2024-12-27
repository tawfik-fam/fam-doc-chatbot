import requests
import asyncio


# def get_docs(question: str, top_k: int, encoder, pinecone_index) -> list[str]:
#     # encode query
#     xq = encoder([question])
#     # search pinecone index
#     res = pinecone_index.query(vector=xq, top_k=top_k, include_metadata=True)
#     # get doc text
#     print(res)
#     docs = [x["metadata"] for x in res["matches"]]
#     return docs

# def generate(query: str, docs: list[str], groq_client, messages):
#     docs = "\n---\n".join(docs)
#     system_message =f'''
#         You are a real state assistant that answers questions about properties in Dubai using the
#         context provided below that is you information.
#         then please generate the response like this schema
#         [ANS]
#         ```json
#         {{
#             answer: HERE THE RESPONSE OF LLM
#         }}```
#         [\ANS]
#         if the context may not have the answer of the question please
#         ask user to provide you more information
#         \n\n
#         CONTEXT:\n
#         {docs}
#         '''
    
#     # generate response
#     chat_response = groq_client.chat.completions.create(
#         model="llama3-70b-8192",
#         messages=messages,
#         stream=True
#     )
#     print(chat_response)
#     for chunk in chat_response:
#         return chunk.choices[0].delta.content
#     # return chat_response.choices[0].message.content
    
# def oracle_db(query:str, top_k:int) -> list[dict]:
#     import oracledb
#     connection = oracledb.connect(user="ai", password="testtest",dsn="91.75.21.131:9522/FREEPDB1")
#     cursor = connection.cursor()
#     exist = cursor.execute("""SELECT v.vector_id, prop.*, t.*,
#             VECTOR_DISTANCE(v.vector,TO_VECTOR(VECTOR_EMBEDDING(ALL_MINILM_L12_V2 USING :query as data)), COSINE) AS distance
#         FROM 
#             ai.prop_vectors v
#             JOIN ai.dld_property prop ON prop.property_id = v.property_id
#             JOIN ai.dld_trans t ON t.prop_id = v.property_id
#         ORDER BY distance ASC
#         FETCH FIRST :top_k ROWS ONLY""", query=query, top_k=top_k)
#     columns = [col[0] for col in cursor.description]
#     cursor.rowfactory = lambda *args: dict(zip(columns, args))
#     exist = cursor.fetchall()
#     print(query)
#     print(exist)
#     connection.close()
#     return exist


# async def question_suggestion_api(message:str)-> list:
#     questions = []

#     # The URL endpoint
#     url = "http://91.75.21.131:9080/ords/ai/rag/question_suggestion"

#     # The payload to be sent with the POST request
#     payload = {
#         'response': message  # Replace with the actual response data
#     }

#     # Making the POST request
#     response = requests.post(url, params=payload)
#     await asyncio.sleep(1)
#     print(response)
#     print(response.text)
    
#     # Check if the request was successful
#     if response.status_code == 200:
#         # Parse the response JSON
#         data = response.json()
#         print(data)

#         # Extract and print the list of questions
#         questions = data.get('expected_responses', [])
        
#         if questions:
#             print("Questions:")
#             for idx, question in enumerate(questions):
#                 print(f"{idx}. {question}")
#         else:
#             print("No questions found in the response.")
#     else:
#         print(f"Request failed with status code: {response.status_code}")
        
#     return questions




# async def send_chatbot_request(question, cohere_api_key)-> str:
#     # The URL endpoint
#     url = "http://91.75.21.131:9080/ords/ai/chatbot/chat_with_file"

#     # The payload to be sent with the POST request
#     payload = {
#         'question': question,
#         'cohere_api_key': cohere_api_key
#     }

#     # Making the POST request
#     try:
#         response = requests.post(url, params=payload)
#         await asyncio.sleep(0.5)
#         print("hello")
#         print(response.text)

#         # Check if the request was successful
#         if response.status_code == 200:
#                 # Parse the response JSON 
#                 return  response.text
#         else:
#             return f"Request failed with status code: {response.status_code}"
    
#     except ValueError:
#         return "Error: Unable to parse JSON response."
#     except requests.Timeout:
#         print("The request timed out. Please try again.")
#     except requests.RequestException as e:
#         print(f"An error occurred: {e}")

# dev_url = "http://172.22.208.99:3003"
dev_url = "http://localhost:3003"
prod_url = "http://91.75.21.130:3003"
    
async def upload_file(file)-> str:
    # The URL endpoint
    url = f"{dev_url}/chatbot/upload_file"

    # The payload to be sent with the POST request
    # print(file)
    files = {
        'file': file
    }
    # Making the POST request
    try:
        response = requests.post(url,files=files)
        # print("hello")
        # print(response.text)

        # Check if the request was successful
        if response.status_code == 200:
                # Parse the response JSON 
                return  response.json()["message"]
        else:
            return f"Request failed with status code: {response.status_code}"
    
    except ValueError:
        return "Error: Unable to parse JSON response."
    except requests.Timeout:
        print("The request timed out. Please try again.")
        return "The request timed out. Please try again."
    except requests.RequestException as e:
        print(f"An error occurred: {e}")

async def chat(question):
    # The URL endpoint
    url = f"{dev_url}/chatbot/chat"

    # The payload to be sent with the POST request
    payload = { 
        'query': question
    }

    # Making the POST request
    try:
        response = requests.post(url,data=payload)
        # print("hello")
        # print(response.text)

        # Check if the request was successful
        return response
    
    except ValueError:
        return "Error: Unable to parse JSON response."
    except requests.Timeout:
        print("The request timed out. Please try again.")
        return "The request timed out. Please try again."
    except requests.RequestException as e:
        print(f"An error occurred: {e}")


async def question_suggestion():
    # The URL endpoint
    url = f"{dev_url}/chatbot/question_suggestion"
    
    # Making the POST request
    try:
        response = requests.get(url)
        # print("hello")
        # print(response.json())

        # Check if the request was successful
        return response.json()
    
    except ValueError:
        return "Error: Unable to parse JSON response."
    except requests.Timeout:
        print("The request timed out. Please try again.")
    except requests.RequestException as e:
        print(f"An error occurred: {e}")
  