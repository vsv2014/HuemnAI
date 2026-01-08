from app.services.knowledge_service import index_all_connectors, TICKET_INDEX
index_all_connectors()
print('TICKET_INDEX_LEN=', len(TICKET_INDEX))
for t in TICKET_INDEX:
    print(t)
